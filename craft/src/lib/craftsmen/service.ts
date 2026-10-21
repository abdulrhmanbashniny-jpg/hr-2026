import { and, count, eq, gt, inArray, sql } from 'drizzle-orm';
import { revalidateTag } from 'next/cache';
import { db } from '@/db';
import { isUniqueViolation } from '@/db/errors';
import { cities, craftsmen, fraudFlags, invoices, portfolioProjects, referrals, users, wallets, leads, trades } from '@/db/schema';
import { audit } from '@/lib/audit';
import { consume, HOUR } from '@/lib/auth/rate-limit';
import { generateReferralCode, parseReferralCode } from '@/lib/codes/damm';
import { assessReferral } from '@/lib/fraud/referral-risk';
import { ApiError } from '@/lib/http';
import { notify } from '@/lib/notifications';
import { normalizeSaudiMobile } from '@/lib/phone';
import { otherAccountsOnDevice, recordSignal, seenOnDevice, seenOnNetworkSince, type RequestFingerprint } from '@/lib/signals';

export const CONSENT_VERSION = '2026-10';

export const profileTag = (code: string) => `craftsman:${code}`;

/** Invalidates the cached public profile immediately (the owner expects to see their edit). */
export function invalidateProfile(code: string) {
  try {
    revalidateTag(profileTag(code), { expire: 0 });
  } catch {
    // Outside a request (scripts, tests): nothing is cached there.
  }
}

export async function findByCode(code: string) {
  const [row] = await db
    .select({ id: craftsmen.id, userId: craftsmen.userId, displayName: craftsmen.displayName, cityId: craftsmen.cityId, tier: craftsmen.tier, referralCode: craftsmen.referralCode, userStatus: users.status, phone: users.phone })
    .from(craftsmen)
    .innerJoin(users, eq(users.id, craftsmen.userId))
    .where(eq(craftsmen.referralCode, code));
  return row ?? null;
}

/** Checks a referral code someone typed: check digit, existence, not their own. */
export async function validateReferralCode(input: string, selfUserId?: string) {
  const parsed = parseReferralCode(input);
  if (!parsed.ok) throw new ApiError('invalid_code', 400, { reason: parsed.reason });
  const ref = await findByCode(parsed.code);
  if (!ref || ref.userStatus !== 'active') throw new ApiError('not_found');
  if (selfUserId && ref.userId === selfUserId) throw new ApiError('self_referral');
  const [city] = await db.select({ nameAr: cities.nameAr, nameEn: cities.nameEn }).from(cities).where(eq(cities.id, ref.cityId));
  return { ref, city };
}

async function codeLength(): Promise<number> {
  const [{ n }] = await db.select({ n: count() }).from(craftsmen);
  // 90,000 six-digit codes exist; move to seven digits before collisions make issuing slow.
  return n > 72_000 ? 7 : 6;
}

export interface OnboardingInput {
  displayName: string;
  cityId: string;
  trades: string[];
  yearsExperience: number;
  referralCode?: string | null;
  clientFingerprint?: string | null;
}

export async function onboard(userId: string, phone: string, input: OnboardingInput, fp: RequestFingerprint) {
  const [existing] = await db.select({ id: craftsmen.id }).from(craftsmen).where(eq(craftsmen.userId, userId));
  if (existing) throw new ApiError('already_onboarded');
  const [city] = await db.select({ id: cities.id }).from(cities).where(eq(cities.id, input.cityId));
  if (!city) throw new ApiError('validation', 400, { cityId: ['unknown'] });
  const validTrades = input.trades.length ? (await db.select({ id: trades.id }).from(trades).where(inArray(trades.id, input.trades))).map((t) => t.id) : [];

  const referrer = input.referralCode ? (await validateReferralCode(input.referralCode, userId)).ref : null;
  const length = await codeLength();

  let created: { id: string; referralCode: string } | null = null;
  for (let attempt = 0; attempt < 12 && !created; attempt++) {
    try {
      created = await db.transaction(async (tx) => {
        const [c] = await tx
          .insert(craftsmen)
          .values({
            userId,
            referralCode: generateReferralCode(Math.random, length),
            displayName: input.displayName.trim(),
            cityId: city.id,
            trades: validTrades,
            yearsExperience: input.yearsExperience,
            whatsapp: phone,
            referredById: referrer?.id ?? null,
            consent: { version: CONSENT_VERSION, acceptedAt: new Date().toISOString() },
          })
          .returning({ id: craftsmen.id, referralCode: craftsmen.referralCode });
        await tx.insert(wallets).values({ craftsmanId: c.id }).onConflictDoNothing();
        await tx.update(users).set({ name: input.displayName.trim() }).where(eq(users.id, userId));
        return c;
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      const [again] = await db.select({ id: craftsmen.id }).from(craftsmen).where(eq(craftsmen.userId, userId));
      if (again) throw new ApiError('already_onboarded');
    }
  }
  if (!created) throw new Error('Could not allocate a referral code');

  if (referrer) {
    const since = new Date(Date.now() - 24 * HOUR);
    const [{ recent }] = await db.select({ recent: count() }).from(referrals).where(and(eq(referrals.referrerId, referrer.id), gt(referrals.createdAt, since)));
    const risk = assessReferral({
      sameDeviceAsReferrer: await seenOnDevice(referrer.userId, fp.deviceId),
      sameNetworkRecent: await seenOnNetworkSince(referrer.userId, fp.ipPrefixHash, since),
      referrerReferralsLast24h: recent,
      refereePhone: phone,
      referrerPhone: referrer.phone,
      sharedDeviceAccounts: await otherAccountsOnDevice(userId, fp.deviceId),
    });
    const [ref] = await db
      .insert(referrals)
      .values({ referrerId: referrer.id, refereeId: created.id, status: risk.hold ? 'held' : 'pending', riskScore: risk.score, riskReasons: risk.reasons })
      .returning({ id: referrals.id });
    if (risk.hold) {
      await db.insert(fraudFlags).values({ subjectType: 'referral', subjectId: ref.id, craftsmanId: referrer.id, rule: risk.reasons[0]?.code ?? 'risk', score: risk.score, details: { reasons: risk.reasons } });
    }
    await recordSignal(userId, 'referral', fp, input.clientFingerprint);
    await notify(referrer.userId, 'referral_joined', { name: input.displayName.trim() }, '/app/referrals');
  }
  return created;
}

/** Counts a contact intent once per visitor, channel and hour, so refreshing a page cannot inflate it. */
export async function recordLead(
  craftsmanId: string,
  channel: (typeof leads.$inferInsert)['channel'],
  source: (typeof leads.$inferInsert)['source'],
  ipHash: string | null,
  meta?: Record<string, unknown>,
) {
  const key = `lead:${craftsmanId}:${channel}:${ipHash ?? 'anon'}`;
  if (!(await consume([{ key, limit: 1, windowMs: HOUR }]))) return;
  await db.insert(leads).values({ craftsmanId, channel, source, ipHash, meta: meta ?? null });
  if (channel === 'profile_view') await db.update(craftsmen).set({ profileViews: sql`${craftsmen.profileViews} + 1` }).where(eq(craftsmen.id, craftsmanId));
}

export interface ProfileUpdate {
  displayName?: string;
  bio?: string | null;
  cityId?: string;
  trades?: string[];
  yearsExperience?: number;
  whatsapp?: string | null;
  acceptsCalls?: boolean;
  warrantyMonths?: number;
  locale?: 'ar' | 'en';
}

export async function updateProfile(craftsmanId: string, userId: string, code: string, patch: ProfileUpdate) {
  const set: Partial<typeof craftsmen.$inferInsert> = { updatedAt: new Date() };
  if (patch.displayName !== undefined) set.displayName = patch.displayName.trim();
  if (patch.bio !== undefined) set.bio = patch.bio?.trim() || null;
  if (patch.cityId !== undefined) {
    const [c] = await db.select({ id: cities.id }).from(cities).where(eq(cities.id, patch.cityId));
    if (!c) throw new ApiError('validation', 400, { cityId: ['unknown'] });
    set.cityId = c.id;
  }
  if (patch.trades !== undefined) set.trades = patch.trades.length ? (await db.select({ id: trades.id }).from(trades).where(inArray(trades.id, patch.trades))).map((t) => t.id) : [];
  if (patch.yearsExperience !== undefined) set.yearsExperience = patch.yearsExperience;
  if (patch.whatsapp !== undefined) {
    if (patch.whatsapp === null || patch.whatsapp === '') set.whatsapp = null;
    else {
      const w = normalizeSaudiMobile(patch.whatsapp);
      if (!w) throw new ApiError('invalid_phone');
      set.whatsapp = w;
    }
  }
  if (patch.acceptsCalls !== undefined) set.acceptsCalls = patch.acceptsCalls;
  if (patch.warrantyMonths !== undefined) set.warrantyMonths = patch.warrantyMonths;
  await db.update(craftsmen).set(set).where(eq(craftsmen.id, craftsmanId));
  if (patch.displayName !== undefined || patch.locale !== undefined)
    await db
      .update(users)
      .set({ ...(patch.displayName !== undefined ? { name: patch.displayName.trim() } : {}), ...(patch.locale ? { locale: patch.locale } : {}) })
      .where(eq(users.id, userId));
  invalidateProfile(code);
}

export async function setAvailability(craftsmanId: string, code: string, availability: 'available' | 'busy' | 'away', until: Date | null) {
  await db.update(craftsmen).set({ availability, availabilityUntil: until, updatedAt: new Date() }).where(eq(craftsmen.id, craftsmanId));
  invalidateProfile(code);
}

export async function craftsmanStats(craftsmanId: string) {
  const [[projects], [approved]] = await Promise.all([
    db
      .select({ total: count(), field: sql<number>`count(*) filter (where ${portfolioProjects.verification} = 'field_verified')`.mapWith(Number) })
      .from(portfolioProjects)
      .where(and(eq(portfolioProjects.craftsmanId, craftsmanId), eq(portfolioProjects.isPublished, true))),
    db.select({ n: count() }).from(invoices).where(and(eq(invoices.craftsmanId, craftsmanId), eq(invoices.status, 'approved'))),
  ]);
  return { projects: projects.total, fieldVerified: projects.field, approvedInvoices: approved.n };
}

export async function requestDeletion(craftsmanId: string, userId: string) {
  await db.update(craftsmen).set({ deletionRequestedAt: new Date() }).where(eq(craftsmen.id, craftsmanId));
  await audit(userId, 'privacy.deletion_requested', { type: 'craftsman', id: craftsmanId });
}

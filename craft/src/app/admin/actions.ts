'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db';
import { isUniqueViolation } from '@/db/errors';
import { cities, craftsmen, dealers, fraudFlags, incentiveRules, invoices, portfolioProjects, referrals, rewards, sessions, users } from '@/db/schema';
import { audit } from '@/lib/audit';
import { apiStaff } from '@/lib/auth/guards';
import type { StaffPermission } from '@/lib/auth/roles';
import { removeAvatar } from '@/lib/craftsmen/avatar';
import { invalidateProfile } from '@/lib/craftsmen/service';
import { reviewDocument } from '@/lib/craftsmen/verification';
import { ApiError } from '@/lib/http';
import { isValidVatNumber } from '@/lib/ids';
import { dictionary, getLocale } from '@/lib/i18n';
import { approveInvoice, payReferralBonus, payWelcomeBonus, rejectInvoice } from '@/lib/invoices/pipeline';
import { notify } from '@/lib/notifications';
import { postLedger } from '@/lib/points/ledger';
import { BrandSettings, ProductInput, saveBrand, saveProduct, setProductActive } from '@/lib/products/service';
import { moderateReview } from '@/lib/reviews/service';
import { fulfillRedemption, rejectRedemption } from '@/lib/rewards/service';
import { economicsSchema } from '@/lib/settings/economics';
import { getEconomics, saveEconomics } from '@/lib/settings/store';

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Runs a console mutation: permission check, uniform error message, and a refresh of the console. */
async function run(permission: StaffPermission, fn: (actorId: string) => Promise<void>, paths: string[] = ['/admin']): Promise<ActionResult> {
  try {
    const s = await apiStaff(permission);
    await fn(s.user.id);
    for (const p of paths) revalidatePath(p, 'layout');
    return { ok: true };
  } catch (err) {
    const t = dictionary(await getLocale());
    if (err instanceof ApiError) return { ok: false, error: t.errors[err.code] ?? t.errors.generic };
    if (err instanceof z.ZodError) return { ok: false, error: t.errors.validation };
    console.error('[admin action]', err);
    return { ok: false, error: t.errors.generic };
  }
}

const uuid = z.uuid();

export async function approveInvoiceAction(id: string, note?: string) {
  return run('invoices:review', (actor) => approveInvoice(uuid.parse(id), actor, note?.slice(0, 300) || undefined));
}

export async function rejectInvoiceAction(id: string, note?: string) {
  return run('invoices:review', (actor) => rejectInvoice(uuid.parse(id), actor, note?.slice(0, 300) || undefined));
}

export async function setTierAction(craftsmanId: string, tier: 'A' | 'B' | 'C', reason: string) {
  return run('craftsmen:manage', async (actor) => {
    const t = z.enum(['A', 'B', 'C']).parse(tier);
    const [c] = await db
      .update(craftsmen)
      .set({ tier: t, tierAssignedAt: new Date(), tierAssignedBy: actor, updatedAt: new Date() })
      .where(eq(craftsmen.id, uuid.parse(craftsmanId)))
      .returning({ userId: craftsmen.userId, code: craftsmen.referralCode });
    if (!c) throw new ApiError('not_found');
    await audit(actor, 'craftsman.tier', { type: 'craftsman', id: craftsmanId }, { tier: t, reason: reason.slice(0, 300) });
    invalidateProfile(c.code);
    await notify(c.userId, 'tier_changed', (d) => ({ tier: d.tiers[t] }), '/app');
  });
}

export async function adjustPointsAction(craftsmanId: string, delta: number, note: string) {
  return run('points:adjust', async (actor) => {
    const amount = z.number().int().min(-1_000_000).max(1_000_000).refine((v) => v !== 0).parse(delta);
    const reason = z.string().trim().min(3).max(300).parse(note);
    const id = uuid.parse(craftsmanId);
    const [target] = await db.select({ userId: craftsmen.userId }).from(craftsmen).where(eq(craftsmen.id, id));
    if (!target) throw new ApiError('not_found');
    if (target.userId === actor) throw new ApiError('self_review', 403);
    await db.transaction(async (tx) => {
      const res = await postLedger(tx, { craftsmanId: id, delta: amount, kind: 'adjustment', idempotencyKey: `adjust:${id}:${crypto.randomUUID()}`, note: reason, createdBy: actor });
      await audit(actor, 'points.adjust', { type: 'craftsman', id }, { delta: amount, note: reason, balanceAfter: res.balanceAfter }, tx);
    });
    const [c] = await db.select({ userId: craftsmen.userId }).from(craftsmen).where(eq(craftsmen.id, id));
    if (c) await notify(c.userId, 'adjustment', { points: amount > 0 ? `+${amount}` : String(amount), note: reason }, '/app');
  });
}

export async function setSuspendedAction(craftsmanId: string, suspended: boolean) {
  return run('craftsmen:manage', async (actor) => {
    const [c] = await db.select({ userId: craftsmen.userId, code: craftsmen.referralCode }).from(craftsmen).where(eq(craftsmen.id, uuid.parse(craftsmanId)));
    if (!c) throw new ApiError('not_found');
    await db.update(users).set({ status: suspended ? 'suspended' : 'active' }).where(eq(users.id, c.userId));
    if (suspended) await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, c.userId));
    await audit(actor, suspended ? 'craftsman.suspend' : 'craftsman.reactivate', { type: 'craftsman', id: craftsmanId });
    invalidateProfile(c.code);
  });
}

export async function verifyProjectAction(projectId: string, verified: boolean) {
  return run('craftsmen:manage', async (actor) => {
    const [p] = await db
      .update(portfolioProjects)
      .set({ verification: verified ? 'field_verified' : 'self', verifiedBy: verified ? actor : null, verifiedAt: verified ? new Date() : null })
      .where(eq(portfolioProjects.id, uuid.parse(projectId)))
      .returning({ craftsmanId: portfolioProjects.craftsmanId });
    if (!p) throw new ApiError('not_found');
    const [c] = await db.select({ code: craftsmen.referralCode }).from(craftsmen).where(eq(craftsmen.id, p.craftsmanId));
    await audit(actor, verified ? 'project.field_verify' : 'project.unverify', { type: 'project', id: projectId });
    if (c) invalidateProfile(c.code);
  });
}

export async function reviewDocumentAction(documentId: string, approve: boolean, note?: string) {
  return run('craftsmen:manage', (actor) => reviewDocument(uuid.parse(documentId), actor, approve, note));
}

export async function resolveFlagAction(flagId: string, outcome: 'dismissed' | 'confirmed') {
  return run('fraud:manage', async (actor) => {
    const [f] = await db
      .update(fraudFlags)
      .set({ status: outcome, resolvedBy: actor, resolvedAt: new Date() })
      .where(and(eq(fraudFlags.id, uuid.parse(flagId)), eq(fraudFlags.status, 'open')))
      .returning();
    if (!f) throw new ApiError('invalid_state');
    if (outcome === 'confirmed' && f.craftsmanId) {
      // Confirmed fraud: suspend, end sessions, refuse everything still pending, void held referrals.
      const [c] = await db.select({ userId: craftsmen.userId, code: craftsmen.referralCode }).from(craftsmen).where(eq(craftsmen.id, f.craftsmanId));
      if (c) {
        await db.update(users).set({ status: 'suspended' }).where(eq(users.id, c.userId));
        await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, c.userId));
        invalidateProfile(c.code);
      }
      await db
        .update(invoices)
        .set({ status: 'rejected', reviewedBy: actor, reviewedAt: new Date(), reviewNote: 'fraud', fingerprint: null })
        .where(and(eq(invoices.craftsmanId, f.craftsmanId), inArray(invoices.status, ['pending', 'flagged', 'processing'])));
      await db.update(referrals).set({ status: 'rejected', reviewedBy: actor }).where(and(eq(referrals.referrerId, f.craftsmanId), eq(referrals.status, 'held')));
    }
    if (f.subjectType === 'invoice' && outcome === 'confirmed')
      await db.update(invoices).set({ status: 'rejected', reviewedBy: actor, reviewedAt: new Date(), fingerprint: null }).where(and(eq(invoices.id, f.subjectId), inArray(invoices.status, ['pending', 'flagged'])));
    await audit(actor, `fraud.${outcome}`, { type: f.subjectType, id: f.subjectId }, { flag: f.id, rule: f.rule });
  });
}

export async function releaseReferralAction(referralId: string) {
  return run('fraud:manage', async (actor) => {
    const eco = await getEconomics();
    const id = uuid.parse(referralId);
    const payouts = await db.transaction(async (tx) => {
      const [peek] = await tx.select({ refereeId: referrals.refereeId }).from(referrals).where(eq(referrals.id, id));
      if (!peek) throw new ApiError('invalid_state');
      // Same lock order as invoice approval (craftsman, then referral), so the two never interleave.
      const [referee] = await tx
        .select({ c: craftsmen, region: cities.regionCode })
        .from(craftsmen)
        .innerJoin(cities, eq(cities.id, craftsmen.cityId))
        .where(eq(craftsmen.id, peek.refereeId))
        .for('update', { of: craftsmen });
      const [r] = await tx.select().from(referrals).where(and(eq(referrals.id, id), eq(referrals.status, 'held'))).for('update');
      if (!r) throw new ApiError('invalid_state');
      const activated = !!referee.c.activatedAt;
      await tx.update(referrals).set({ status: activated ? 'activated' : 'pending', activatedAt: activated ? new Date() : null, reviewedBy: actor }).where(eq(referrals.id, r.id));
      await tx.update(fraudFlags).set({ status: 'dismissed', resolvedBy: actor, resolvedAt: new Date() }).where(and(eq(fraudFlags.subjectId, r.id), eq(fraudFlags.status, 'open')));
      await audit(actor, 'referral.release', { type: 'referral', id: r.id }, undefined, tx);
      if (!activated) return [];
      // The referee was activated while the referral was held: both bonuses were withheld until now.
      const out = [await payWelcomeBonus(tx, referee.c.id, referee.c.userId, eco), await payReferralBonus(tx, r.id, r.referrerId, referee.c, referee.region, eco)];
      return out.filter((p) => p !== null);
    });
    for (const p of payouts) await notify(p.userId, p.kind, p.vars, p.kind === 'referral_bonus' ? '/app/referrals' : '/app');
  });
}

export async function rejectReferralAction(referralId: string) {
  return run('fraud:manage', async (actor) => {
    const [r] = await db.update(referrals).set({ status: 'rejected', reviewedBy: actor }).where(and(eq(referrals.id, uuid.parse(referralId)), eq(referrals.status, 'held'))).returning({ id: referrals.id });
    if (!r) throw new ApiError('invalid_state');
    await db.update(fraudFlags).set({ status: 'confirmed', resolvedBy: actor, resolvedAt: new Date() }).where(and(eq(fraudFlags.subjectId, r.id), eq(fraudFlags.status, 'open')));
    await audit(actor, 'referral.reject', { type: 'referral', id: r.id });
  });
}

const RuleInput = z
  .object({
    name: z.string().trim().min(3).max(80),
    target: z.enum(['invoice', 'referral_bonus', 'commission']),
    scope: z.enum(['national', 'region', 'city']),
    regionCode: z.string().max(10).nullable(),
    cityId: z.string().max(40).nullable(),
    multiplier: z.number().min(1).max(10),
    flatBonus: z.number().int().min(0).max(100_000),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
  })
  .refine((r) => new Date(r.endsAt) > new Date(r.startsAt))
  .refine((r) => (r.scope === 'city' ? !!r.cityId : r.scope === 'region' ? !!r.regionCode : true));

export async function saveRuleAction(input: z.input<typeof RuleInput>) {
  return run('incentives:manage', async (actor) => {
    const r = RuleInput.parse(input);
    const [row] = await db
      .insert(incentiveRules)
      .values({
        ...r,
        regionCode: r.scope === 'region' ? r.regionCode : null,
        cityId: r.scope === 'city' ? r.cityId : null,
        startsAt: new Date(r.startsAt),
        endsAt: new Date(r.endsAt),
        createdBy: actor,
      })
      .returning({ id: incentiveRules.id });
    await audit(actor, 'incentive.create', { type: 'incentive_rule', id: row.id }, r);
  });
}

export async function toggleRuleAction(id: string, active: boolean) {
  return run('incentives:manage', async (actor) => {
    await db.update(incentiveRules).set({ isActive: active }).where(eq(incentiveRules.id, uuid.parse(id)));
    await audit(actor, active ? 'incentive.enable' : 'incentive.disable', { type: 'incentive_rule', id });
  });
}

const RewardInput = z.object({
  id: z.uuid().optional(),
  kind: z.enum(['fuel_voucher', 'supplier_discount', 'tool', 'cash_out', 'other']),
  titleAr: z.string().trim().min(3).max(120),
  titleEn: z.string().trim().min(3).max(120),
  partnerName: z.string().trim().max(80).nullable(),
  pointsCost: z.number().int().min(1).max(10_000_000),
  valueSar: z.number().min(0).max(1_000_000).nullable(),
  stock: z.number().int().min(0).max(1_000_000).nullable(),
  minTier: z.enum(['A', 'B', 'C']).nullable(),
  isActive: z.boolean(),
});

export async function saveRewardAction(input: z.input<typeof RewardInput>) {
  return run('rewards:manage', async (actor) => {
    const { id, ...r } = RewardInput.parse(input);
    if (id) await db.update(rewards).set(r).where(eq(rewards.id, id));
    else await db.insert(rewards).values(r);
    await audit(actor, id ? 'reward.update' : 'reward.create', { type: 'reward', id: id ?? 'new' }, r);
  });
}

export async function fulfillRedemptionAction(id: string, voucherCode: string) {
  return run('redemptions:fulfill', (actor) => fulfillRedemption(uuid.parse(id), actor, voucherCode.trim().slice(0, 120) || null, null));
}

export async function rejectRedemptionAction(id: string, note?: string) {
  return run('redemptions:fulfill', (actor) => rejectRedemption(uuid.parse(id), actor, note ?? null));
}

const DealerInput = z.object({
  name: z.string().trim().min(3).max(120),
  vatNumber: z.string().refine(isValidVatNumber),
  brandId: z.uuid().nullable(),
  cityId: z.string().max(40).nullable(),
});

export async function saveDealerAction(input: z.input<typeof DealerInput>) {
  return run('dealers:manage', async (actor) => {
    const d = DealerInput.parse(input);
    try {
      const [row] = await db.insert(dealers).values({ ...d, vatNumber: d.vatNumber.replace(/\D/g, '') }).returning({ id: dealers.id });
      await audit(actor, 'dealer.create', { type: 'dealer', id: row.id }, d);
    } catch (err) {
      if (isUniqueViolation(err)) throw new ApiError('validation');
      throw err;
    }
  });
}

export async function toggleDealerAction(id: string, active: boolean) {
  return run('dealers:manage', async (actor) => {
    await db.update(dealers).set({ isActive: active }).where(eq(dealers.id, uuid.parse(id)));
    await audit(actor, active ? 'dealer.enable' : 'dealer.disable', { type: 'dealer', id });
  });
}

export async function saveEconomicsAction(input: unknown) {
  return run('settings:manage', async (actor) => {
    const value = economicsSchema.parse(input);
    if (value.autoApproveMaxRisk >= value.flagMinRisk) throw new ApiError('validation');
    await saveEconomics(value, actor);
    await audit(actor, 'settings.economics', { type: 'settings', id: 'economics' }, value);
  });
}

// ───────────── Card photo, reviews, factory catalogue ─────────────

export async function removeCraftsmanPhotoAction(craftsmanId: string, reason: string) {
  return run(
    'craftsmen:manage',
    async (actor) => {
      const res = await removeAvatar(z.uuid().parse(craftsmanId));
      if (res.removed) await audit(actor, 'craftsman.photo_remove', { type: 'craftsman', id: craftsmanId }, { reason: reason.slice(0, 300) });
    },
    ['/admin/craftsmen'],
  );
}

export async function moderateReviewAction(reviewId: string, approve: boolean) {
  return run('reviews:moderate', (actor) => moderateReview(actor, z.uuid().parse(reviewId), approve), ['/admin/reviews']);
}

export async function saveProductAction(input: z.input<typeof ProductInput>) {
  return run(
    'products:manage',
    async (actor) => {
      const id = await saveProduct(actor, ProductInput.parse(input));
      await audit(actor, 'product.save', { type: 'product', id });
    },
    ['/admin/products', '/'],
  );
}

export async function toggleProductAction(id: string, active: boolean) {
  return run(
    'products:manage',
    async (actor) => {
      await setProductActive(z.uuid().parse(id), active);
      await audit(actor, active ? 'product.activate' : 'product.deactivate', { type: 'product', id });
    },
    ['/admin/products', '/'],
  );
}

export async function saveBrandAction(input: z.input<typeof BrandSettings>) {
  return run(
    'products:manage',
    async (actor) => {
      await saveBrand(BrandSettings.parse(input), actor);
      await audit(actor, 'brand.save');
    },
    ['/admin/products', '/'],
  );
}

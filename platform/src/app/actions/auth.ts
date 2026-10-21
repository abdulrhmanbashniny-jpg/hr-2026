'use server';

import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/db';
import { invitations, memberships, passwordResets, promoCodes, promoRedemptions, sessions, subscriptions, tenants, users } from '@/db/schema';
import { audit } from '@/lib/audit';
import { hashPassword, passwordProblem, verifyPassword } from '@/lib/auth/password';
import { consume, HOUR, isLimited, MINUTE, recordHit } from '@/lib/auth/rate-limit';
import { safeNext } from '@/lib/auth/safe-next';
import { clientIp, createSession, destroySession, getSession } from '@/lib/auth/session';
import { promoProblem } from '@/lib/billing/pricing';
import { randomToken, sha256 } from '@/lib/crypto';
import { env } from '@/lib/env';
import { f, getI18n } from '@/lib/i18n';
import { emailEnabled, emailLayout, escapeHtml, sendEmail } from '@/lib/notifications/email';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { str } from '@/lib/actions';
import type { ActionResult } from '@/lib/action-result';

// A real bcrypt hash compared when the e-mail is unknown, so timing does not reveal which e-mails exist.
let dummyHash: Promise<string> | null = null;
function timingDummy() {
  dummyHash ??= hashPassword(randomToken(16));
  return dummyHash;
}

export async function signIn(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { t } = await getI18n();
  const email = str(form, 'email').toLowerCase();
  const password = str(form, 'password');
  const ip = (await clientIp()) ?? 'unknown';
  // Failed attempts are limited per address and per account, across all server instances.
  if ((await isLimited(`login:ip:${ip}`, 30, 15 * MINUTE)) || (await isLimited(`login:email:${email}`, 10, 15 * MINUTE))) return { ok: false, error: t.auth.tooMany };
  const [user] = await db.select().from(users).where(eq(users.email, email));
  const valid = user ? await verifyPassword(password, user.passwordHash) : (await verifyPassword(password, await timingDummy()), false);
  if (!user || !valid) {
    await recordHit(`login:ip:${ip}`, `login:email:${email}`);
    return { ok: false, error: t.auth.invalid };
  }
  if (user.disabledAt) return { ok: false, error: t.auth.disabled };
  const [m] = await db.select().from(memberships).where(eq(memberships.userId, user.id)).limit(1);
  await createSession(user.id, m?.tenantId ?? null);
  await audit({ tenantId: m?.tenantId ?? null, userId: user.id, action: 'auth.sign_in', summary: `تسجيل دخول ${user.email}` });
  redirect(user.isSuperAdmin && !m ? '/admin' : safeNext(str(form, 'next') || '/app', env.appUrl));
}

export async function signOut() {
  await destroySession();
  redirect('/login');
}

const registerSchema = z.object({
  companyName: z.string().min(2).max(120),
  crNumber: z.string().regex(/^\d{10}$/).or(z.literal('')),
  name: z.string().min(2).max(120),
  email: z.email().max(200),
  phone: z.string().max(20),
  password: z.string().min(1).max(200),
  promo: z.string().max(40),
});

function slugify(name: string): string {
  const ascii = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  return `${ascii || 'co'}-${randomToken(4).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}

export async function register(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { t } = await getI18n();
  if (!(await consume([{ key: `register:ip:${(await clientIp()) ?? 'unknown'}`, limit: 10, windowMs: HOUR }]))) return { ok: false, error: t.auth.tooMany };
  const parsed = registerSchema.safeParse({
    companyName: str(form, 'companyName'),
    crNumber: str(form, 'crNumber'),
    name: str(form, 'name'),
    email: str(form, 'email').toLowerCase(),
    phone: str(form, 'phone'),
    password: str(form, 'password'),
    promo: str(form, 'promo').toUpperCase(),
  });
  if (!parsed.success) return { ok: false, error: t.common.error };
  const input = parsed.data;
  const problem = passwordProblem(input.password);
  if (problem) return { ok: false, error: t.auth[problem as 'password_too_short' | 'password_too_weak'] };
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email));
  if (exists) return { ok: false, error: t.auth.emailTaken };

  let promo: typeof promoCodes.$inferSelect | undefined;
  if (input.promo) {
    [promo] = await db.select().from(promoCodes).where(eq(promoCodes.code, input.promo));
    const why = promoProblem(promo);
    if (why) return { ok: false, error: f(t.auth.promoInvalid, { reason: t.promoProblems[why] }) };
  }

  const trialDays = env.trialDays + (promo?.kind === 'trial_extension' ? promo.value : 0);
  const passwordHash = await hashPassword(input.password);
  const { tenantId, userId } = await db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({ name: input.companyName, slug: slugify(input.companyName), crNumber: input.crNumber || null, settings: DEFAULT_SETTINGS })
      .returning();
    const [user] = await tx.insert(users).values({ email: input.email, name: input.name, phone: input.phone || null, passwordHash }).returning();
    await tx.insert(memberships).values({ tenantId: tenant.id, userId: user.id, role: 'owner' });
    await tx.insert(subscriptions).values({
      tenantId: tenant.id,
      status: 'trialing',
      trialEndsAt: new Date(Date.now() + trialDays * 86_400_000),
      pendingPromoCodeId: promo && promo.kind !== 'trial_extension' ? promo.id : null,
    });
    if (promo) {
      await tx.insert(promoRedemptions).values({ promoCodeId: promo.id, tenantId: tenant.id });
      await tx.update(promoCodes).set({ redeemedCount: sql`${promoCodes.redeemedCount} + 1` }).where(eq(promoCodes.id, promo.id));
    }
    return { tenantId: tenant.id, userId: user.id };
  });
  await createSession(userId, tenantId);
  await audit({ tenantId, userId, action: 'tenant.created', entityType: 'tenant', entityId: tenantId, summary: `إنشاء مساحة عمل «${input.companyName}» (تجربة ${trialDays} يوماً)`, metadata: { promo: promo?.code ?? null } });
  redirect('/app/imports');
}

export async function requestPasswordReset(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { t } = await getI18n();
  const email = str(form, 'email').toLowerCase();
  // Same answer whether or not the e-mail exists or the limit is hit, so nothing is revealed.
  const allowed = await consume([
    { key: `reset:ip:${(await clientIp()) ?? 'unknown'}`, limit: 10, windowMs: HOUR },
    { key: `reset:email:${email}`, limit: 3, windowMs: HOUR },
  ]);
  if (!allowed) return { ok: true, message: t.auth.resetSent };
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (user && !user.disabledAt && (await emailEnabled(null))) {
    const token = randomToken(32);
    await db.insert(passwordResets).values({ userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60_000) });
    const link = `${env.appUrl}/reset-password/${token}`;
    await sendEmail(null, {
      to: user.email,
      subject: 'متابعة · إعادة تعيين كلمة المرور',
      html: emailLayout('إعادة تعيين كلمة المرور', `<p>مرحباً ${escapeHtml(user.name)}،</p><p>لإعادة تعيين كلمة المرور افتح الرابط التالي خلال ساعة:</p><p><a href="${link}" style="color:#0f5b4b">${link}</a></p><p>إن لم تطلب ذلك فتجاهل هذه الرسالة.</p>`, 'منصة متابعة'),
      text: `إعادة تعيين كلمة المرور: ${link}`,
    }).catch((err) => console.error('reset mail failed', err));
  }
  return { ok: true, message: t.auth.resetSent };
}

export async function resetPassword(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { t } = await getI18n();
  const token = str(form, 'token');
  const password = str(form, 'password');
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: t.auth[problem as 'password_too_short' | 'password_too_weak'] };
  if (!(await consume([{ key: `resetpw:ip:${(await clientIp()) ?? 'unknown'}`, limit: 20, windowMs: HOUR }]))) return { ok: false, error: t.auth.tooMany };
  // Claim the token atomically: it works once, even with parallel requests.
  const [row] = await db
    .update(passwordResets)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResets.tokenHash, sha256(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())))
    .returning({ id: passwordResets.id, userId: passwordResets.userId });
  if (!row) return { ok: false, error: t.auth.resetInvalid };
  await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, row.userId));
  await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, row.userId), isNull(sessions.revokedAt)));
  await audit({ tenantId: null, userId: row.userId, action: 'auth.password_reset', summary: 'إعادة تعيين كلمة المرور' });
  return { ok: true, message: t.auth.resetDone };
}

/**
 * Accepting a company invitation. An existing account must already be signed in as the invited
 * e-mail; the page never asks for its password, so an invitation link cannot be used to guess it.
 * A new address creates its account here.
 */
export async function acceptInvitation(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { t } = await getI18n();
  if (!(await consume([{ key: `invite:ip:${(await clientIp()) ?? 'unknown'}`, limit: 20, windowMs: HOUR }]))) return { ok: false, error: t.auth.tooMany };
  const token = str(form, 'token');
  const [inv] = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.tokenHash, sha256(token)), isNull(invitations.acceptedAt), gt(invitations.expiresAt, new Date())));
  if (!inv) return { ok: false, error: t.auth.inviteInvalid };
  let [user] = await db.select().from(users).where(eq(users.email, inv.email));
  if (user) {
    const s = await getSession();
    if (!s || s.user.id !== user.id) return { ok: false, error: f(t.auth.inviteSignIn, { email: inv.email }) };
  } else {
    const password = str(form, 'password');
    const problem = passwordProblem(password);
    if (problem) return { ok: false, error: t.auth[problem as 'password_too_short' | 'password_too_weak'] };
    const name = str(form, 'name');
    if (name.length < 2) return { ok: false, error: t.common.error };
    [user] = await db.insert(users).values({ email: inv.email, name, phone: str(form, 'phone') || null, passwordHash: await hashPassword(password) }).returning();
  }
  // Claim the invitation atomically so a link works exactly once.
  const [claimed] = await db
    .update(invitations)
    .set({ acceptedAt: new Date() })
    .where(and(eq(invitations.id, inv.id), isNull(invitations.acceptedAt)))
    .returning({ id: invitations.id });
  if (!claimed) return { ok: false, error: t.auth.inviteInvalid };
  await db.insert(memberships).values({ tenantId: inv.tenantId, userId: user.id, role: inv.role }).onConflictDoNothing();
  await createSession(user.id, inv.tenantId);
  await audit({ tenantId: inv.tenantId, userId: user.id, action: 'member.joined', entityType: 'user', entityId: user.id, summary: `انضم ${user.email} بدور ${inv.role}` });
  redirect('/app');
}

/** Used by the auth pages to send already signed-in users to the app. */
export async function currentUserHome(): Promise<string | null> {
  const s = await getSession();
  if (!s) return null;
  return s.tenant ? '/app' : s.user.isSuperAdmin ? '/admin' : null;
}

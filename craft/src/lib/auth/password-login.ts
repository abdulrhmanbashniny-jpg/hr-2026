import { and, eq, isNull, ne } from 'drizzle-orm';
import { db } from '@/db';
import { sessions, users } from '@/db/schema';
import { audit } from '@/lib/audit';
import { ApiError } from '@/lib/http';
import { normalizeSaudiMobile } from '@/lib/phone';
import { recordSignal, requestFingerprint } from '@/lib/signals';
import { hashPassword, passwordProblem, temporaryPassword, verifyPassword, type PasswordProblem } from './password';
import { consume, HOUR, MINUTE } from './rate-limit';
import { isStaff, staffCan, type UserRole } from './roles';
import { createSession } from './session';

const PROBLEM_ERROR: Record<PasswordProblem, 'password_too_short' | 'password_too_long' | 'password_too_common'> = {
  too_short: 'password_too_short',
  too_long: 'password_too_long',
  too_common: 'password_too_common',
};

function assertStrong(password: string, phone?: string) {
  const problem = passwordProblem(password, phone);
  if (problem) throw new ApiError(PROBLEM_ERROR[problem]);
}

/**
 * Phone and password. The same answer for an unknown number, a number without a password and a
 * wrong password, and the same time spent hashing, so the form does not reveal who is registered.
 * Guesses are capped per number and requester (a stranger cannot lock the owner out from their own
 * network), with a looser daily ceiling per number and a cap per network.
 */
export async function loginWithPassword(rawPhone: string, password: string): Promise<{ userId: string; role: UserRole; mustChangePassword: boolean }> {
  const phone = normalizeSaudiMobile(rawPhone);
  if (!phone) throw new ApiError('invalid_phone');
  const fp = await requestFingerprint();
  const requester = fp.ipHash ?? fp.deviceId ?? 'anon';
  const allowed = await consume([
    { key: `pw:phone:${phone}:${requester}`, limit: 6, windowMs: 15 * MINUTE },
    { key: `pw:phone-day:${phone}`, limit: 60, windowMs: 24 * HOUR },
    ...(fp.ipHash ? [{ key: `pw:ip:${fp.ipHash}`, limit: 40, windowMs: HOUR }] : []),
  ]);
  if (!allowed) throw new ApiError('rate_limited');

  const [user] = await db.select().from(users).where(eq(users.phone, phone));
  const valid = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user || !valid) throw new ApiError('invalid_credentials');
  if (user.status === 'suspended') throw new ApiError('account_suspended');

  await createSession(user.id);
  await recordSignal(user.id, 'login', fp);
  return { userId: user.id, role: user.role, mustChangePassword: user.mustChangePassword };
}

/**
 * A new craftsman account from a phone number and a password. This does not prove the number is
 * theirs (no SMS yet); staff confirm it before anything of value leaves the platform, and a number
 * that is already registered can only be recovered through staff.
 */
export async function registerWithPassword(rawPhone: string, password: string): Promise<{ userId: string }> {
  const phone = normalizeSaudiMobile(rawPhone);
  if (!phone) throw new ApiError('invalid_phone');
  assertStrong(password, phone);
  const fp = await requestFingerprint();
  const allowed = await consume([
    ...(fp.ipHash ? [{ key: `register:ip:${fp.ipHash}`, limit: 5, windowMs: HOUR }, { key: `register:ip-day:${fp.ipHash}`, limit: 20, windowMs: 24 * HOUR }] : []),
    ...(fp.deviceId ? [{ key: `register:device:${fp.deviceId}`, limit: 5, windowMs: 24 * HOUR }] : []),
    { key: `register:phone:${phone}`, limit: 10, windowMs: HOUR },
  ]);
  if (!allowed) throw new ApiError('rate_limited');

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({ phone, passwordHash, passwordChangedAt: new Date() })
    .onConflictDoNothing({ target: users.phone })
    .returning({ id: users.id });
  if (!user) throw new ApiError('phone_taken');

  await createSession(user.id);
  await recordSignal(user.id, 'signup', fp);
  return { userId: user.id };
}

/**
 * The signed-in user sets a new password. The current one is required when there is one (a stolen
 * session alone cannot lock the owner out). Every other session is signed out.
 */
export async function changePassword(userId: string, sessionId: string, current: string | undefined, next: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new ApiError('unauthenticated');
  const allowed = await consume([{ key: `pw:change:${userId}`, limit: 8, windowMs: 15 * MINUTE }]);
  if (!allowed) throw new ApiError('rate_limited');
  if (user.passwordHash && !(await verifyPassword(current ?? '', user.passwordHash))) throw new ApiError('wrong_password');
  assertStrong(next, user.phone);
  if (user.passwordHash && (await verifyPassword(next, user.passwordHash))) throw new ApiError('password_reused');

  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: await hashPassword(next), passwordChangedAt: new Date(), mustChangePassword: false }).where(eq(users.id, userId));
    await tx.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, userId), ne(sessions.id, sessionId), isNull(sessions.revokedAt)));
    await audit(userId, 'auth.password_changed', { type: 'user', id: userId }, undefined, tx);
  });
}

/** Staff may act on craftsmen; only a super admin may act on staff, and nobody on themselves. */
function assertCanManage(actor: { id: string; role: UserRole }, target: { id: string; role: UserRole }) {
  if (actor.id === target.id) throw new ApiError('self_review');
  if (isStaff(target.role) ? !staffCan(actor.role, 'settings:manage') : !staffCan(actor.role, 'craftsmen:manage')) throw new ApiError('forbidden');
}

/**
 * Forgotten password, without SMS: staff issue a one-time password, shown once, and hand it over on
 * the number on file (which also confirms the number). The user must replace it at the next sign-in.
 */
export async function resetPasswordByStaff(actor: { id: string; role: UserRole }, targetUserId: string): Promise<string> {
  const [target] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, targetUserId));
  if (!target) throw new ApiError('not_found');
  assertCanManage(actor, target);
  const temp = temporaryPassword();
  const passwordHash = await hashPassword(temp);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash, passwordChangedAt: new Date(), mustChangePassword: true }).where(eq(users.id, target.id));
    await tx.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, target.id), isNull(sessions.revokedAt)));
    await audit(actor.id, 'auth.password_reset', { type: 'user', id: target.id }, undefined, tx);
  });
  return temp;
}

/** Staff reached the owner on this number (a call or a WhatsApp reply). */
export async function confirmPhoneByStaff(actor: { id: string; role: UserRole }, targetUserId: string, confirmed: boolean) {
  const [target] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, targetUserId));
  if (!target) throw new ApiError('not_found');
  assertCanManage(actor, target);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ phoneVerifiedAt: confirmed ? new Date() : null }).where(eq(users.id, target.id));
    await audit(actor.id, confirmed ? 'auth.phone_confirmed' : 'auth.phone_unconfirmed', { type: 'user', id: target.id }, undefined, tx);
  });
}

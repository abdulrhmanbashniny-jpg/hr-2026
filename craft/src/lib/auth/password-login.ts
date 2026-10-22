import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { deviceSignals, sessions, users } from '@/db/schema';
import { audit } from '@/lib/audit';
import { ApiError } from '@/lib/http';
import { normalizeSaudiMobile } from '@/lib/phone';
import { recordSignal, requestFingerprint } from '@/lib/signals';
import { hashPassword, passwordProblem, temporaryPasswordForm, verifyPassword, type PasswordProblem } from './password';
import { consume, HOUR, isLimited, MINUTE, recordHit } from './rate-limit';
import { failureKey, issueTemporaryPassword } from './temporary';
import { isStaff, staffCan, type UserRole } from './roles';
import { createSession } from './session';

const PROBLEM_ERROR: Record<PasswordProblem, 'password_too_short' | 'password_too_long' | 'password_too_common'> = {
  too_short: 'password_too_short',
  too_long: 'password_too_long',
  too_common: 'password_too_common',
};

/** A staff-issued one-time password stops working after this long; staff issue a new one. */
const TEMPORARY_PASSWORD_DAYS = 7;
/** Failed guesses on one number, from anywhere, before only known devices may keep trying. */
const NUMBER_FAILURE_CEILING = 30;

/** Whether this browser has signed in to the account before (the device cookie set by the proxy). */
async function knownDevice(userId: string, deviceId: string | null): Promise<boolean> {
  if (!deviceId) return false;
  const [row] = await db
    .select({ id: deviceSignals.id })
    .from(deviceSignals)
    .where(and(eq(deviceSignals.userId, userId), eq(deviceSignals.deviceId, deviceId)))
    .limit(1);
  return !!row;
}

/**
 * Checks a password, accepting a staff-issued one-time password however it was typed (lower case,
 * without the dashes) while one is in force, and refusing it once it has expired.
 */
async function passwordMatches(user: { passwordHash: string | null; mustChangePassword: boolean; passwordChangedAt: Date | null } | undefined, password: string): Promise<boolean> {
  if (await verifyPassword(password, user?.passwordHash ?? null)) {
    return !(user!.mustChangePassword && temporaryExpired(user!.passwordChangedAt));
  }
  if (!user?.mustChangePassword) return false;
  const typed = temporaryPasswordForm(password);
  return !!typed && typed !== password && !temporaryExpired(user.passwordChangedAt) && (await verifyPassword(typed, user.passwordHash));
}

function temporaryExpired(issuedAt: Date | null): boolean {
  return !issuedAt || Date.now() - issuedAt.getTime() > TEMPORARY_PASSWORD_DAYS * 24 * HOUR;
}

function assertStrong(password: string, phone?: string) {
  const problem = passwordProblem(password, phone);
  if (problem) throw new ApiError(PROBLEM_ERROR[problem]);
}

/**
 * Phone and password. The same answer for an unknown number, a number without a password and a
 * wrong password, and the same time spent hashing, so the form does not reveal who is registered.
 *
 * Guessing is capped per number and requester, and per network, which stops guessing from one
 * place. Across all requesters, failed guesses on a number are counted too; past the ceiling only
 * a device that has signed in to the account before may keep trying, so a distributed guesser is
 * stopped and a stranger still cannot lock the owner out of their own phone.
 */
export async function loginWithPassword(rawPhone: string, password: string): Promise<{ userId: string; role: UserRole; mustChangePassword: boolean }> {
  const phone = normalizeSaudiMobile(rawPhone);
  if (!phone) throw new ApiError('invalid_phone');
  const fp = await requestFingerprint();
  const requester = fp.ipHash ?? fp.deviceId ?? 'anon';
  const allowed = await consume([
    { key: `pw:phone:${phone}:${requester}`, limit: 6, windowMs: 15 * MINUTE },
    ...(fp.ipHash ? [{ key: `pw:ip:${fp.ipHash}`, limit: 40, windowMs: HOUR }] : []),
  ]);
  if (!allowed) throw new ApiError('rate_limited');

  const [user] = await db.select().from(users).where(eq(users.phone, phone));
  if ((await isLimited(failureKey(phone), NUMBER_FAILURE_CEILING, 24 * HOUR)) && !(user && (await knownDevice(user.id, fp.deviceId)))) throw new ApiError('rate_limited');
  if (!user || !(await passwordMatches(user, password))) {
    await recordHit(failureKey(phone));
    throw new ApiError('invalid_credentials');
  }
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
  if (user.passwordHash && !(await passwordMatches(user, current ?? ''))) throw new ApiError('wrong_password');
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
  return issueTemporaryPassword(target.id, actor.id);
}

/**
 * Removes an account that never created a card: a number someone else registered, or a sign-up
 * the owner wants to start again. Staff accounts and members with a card are refused.
 */
export async function deleteAccountWithoutCard(actor: { id: string; role: UserRole }, targetUserId: string) {
  const [target] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, targetUserId));
  if (!target) throw new ApiError('not_found');
  assertCanManage(actor, target);
  if (isStaff(target.role)) throw new ApiError('forbidden');
  await db.transaction(async (tx) => {
    const has = await tx.execute(sql`SELECT 1 FROM craftsmen WHERE user_id = ${target.id} LIMIT 1`);
    if (has.rows.length) throw new ApiError('invalid_state');
    await tx.delete(users).where(eq(users.id, target.id));
    await audit(actor.id, 'auth.account_deleted', { type: 'user', id: target.id }, undefined, tx);
  });
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

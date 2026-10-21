import { and, eq, isNull, lt } from 'drizzle-orm';
import { db } from '@/db';
import { otpChallenges, users } from '@/db/schema';
import { hmac, randomDigits, safeEqual } from '@/lib/crypto';
import { env, isProduction } from '@/lib/env';
import { ApiError } from '@/lib/http';
import { normalizeSaudiMobile } from '@/lib/phone';
import { recordSignal, requestFingerprint } from '@/lib/signals';
import { sendSms } from '@/lib/sms';
import { digitsOnly } from '@/lib/digits';
import { consume, HOUR, MINUTE } from './rate-limit';
import { createSession } from './session';
import type { UserRole } from './roles';

const OTP_TTL_MS = 5 * MINUTE;
const RESEND_AFTER_MS = 45_000;
const MAX_ATTEMPTS = 5;

const codeHash = (challengeId: string, code: string) => hmac(`${challengeId}:${code}`, 'otp');

/** The console SMS driver shows the code to the developer; never in production unless explicitly allowed. */
function exposeDevCode(): boolean {
  return env.sms.driver === 'console' && (!isProduction || process.env.ALLOW_DEV_OTP === 'true');
}

export async function requestOtp(rawPhone: string, locale: 'ar' | 'en') {
  const phone = normalizeSaudiMobile(rawPhone);
  if (!phone) throw new ApiError('invalid_phone');
  const fp = await requestFingerprint();
  const allowed = await consume([
    { key: `otp:phone:${phone}`, limit: 3, windowMs: 10 * MINUTE },
    { key: `otp:phone-day:${phone}`, limit: 10, windowMs: 24 * HOUR },
    ...(fp.ipHash ? [{ key: `otp:ip:${fp.ipHash}`, limit: 15, windowMs: HOUR }] : []),
  ]);
  if (!allowed) throw new ApiError('rate_limited');

  const code = randomDigits(6);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const [challenge] = await db.insert(otpChallenges).values({ phone, codeHash: 'pending', expiresAt, ipHash: fp.ipHash }).returning({ id: otpChallenges.id });
  await db.update(otpChallenges).set({ codeHash: codeHash(challenge.id, code) }).where(eq(otpChallenges.id, challenge.id));

  // The code comes first so iOS and Android offer it for autofill.
  const text = locale === 'ar' ? `${code} رمز الدخول إلى حِرفة. لا تشاركه مع أحد.\n@hirfa.sa #${code}` : `${code} is your Hirfa sign-in code. Don't share it.\n@hirfa.sa #${code}`;
  const sent = await sendSms(phone, text);
  if (!sent.ok) throw new ApiError('sms_failed');

  // Opportunistic clean-up of old challenges.
  if (Math.random() < 0.05) await db.delete(otpChallenges).where(lt(otpChallenges.expiresAt, new Date(Date.now() - 24 * HOUR)));

  return {
    challengeId: challenge.id,
    phone,
    expiresAt: expiresAt.toISOString(),
    resendAt: new Date(Date.now() + RESEND_AFTER_MS).toISOString(),
    ...(exposeDevCode() ? { devCode: code } : {}),
  };
}

export async function verifyOtp(challengeId: string, rawCode: string): Promise<{ userId: string; role: UserRole; isNew: boolean }> {
  const code = digitsOnly(rawCode);
  const [c] = await db.select().from(otpChallenges).where(eq(otpChallenges.id, challengeId));
  if (!c || c.consumedAt || c.expiresAt < new Date()) throw new ApiError('otp_expired');
  if (c.attempts >= MAX_ATTEMPTS) throw new ApiError('otp_locked', 429);

  // Count the attempt before comparing, atomically, so parallel guesses cannot exceed the limit.
  const [counted] = await db
    .update(otpChallenges)
    .set({ attempts: c.attempts + 1 })
    .where(and(eq(otpChallenges.id, c.id), eq(otpChallenges.attempts, c.attempts), isNull(otpChallenges.consumedAt)))
    .returning({ id: otpChallenges.id });
  if (!counted) throw new ApiError('otp_invalid');
  if (code.length !== 6 || !safeEqual(codeHash(c.id, code), c.codeHash)) throw new ApiError('otp_invalid');

  const [consumed] = await db
    .update(otpChallenges)
    .set({ consumedAt: new Date() })
    .where(and(eq(otpChallenges.id, c.id), isNull(otpChallenges.consumedAt)))
    .returning({ id: otpChallenges.id });
  if (!consumed) throw new ApiError('otp_expired');
  // Any other open challenge for this number is now void.
  await db.update(otpChallenges).set({ consumedAt: new Date() }).where(and(eq(otpChallenges.phone, c.phone), isNull(otpChallenges.consumedAt), lt(otpChallenges.createdAt, c.createdAt)));

  let [user] = await db.select().from(users).where(eq(users.phone, c.phone));
  const isNew = !user;
  if (!user) [user] = await db.insert(users).values({ phone: c.phone }).onConflictDoNothing().returning();
  if (!user) [user] = await db.select().from(users).where(eq(users.phone, c.phone));
  if (user.status === 'suspended') throw new ApiError('account_suspended');

  await createSession(user.id);
  await recordSignal(user.id, isNew ? 'signup' : 'login', await requestFingerprint());
  return { userId: user.id, role: user.role, isNew };
}

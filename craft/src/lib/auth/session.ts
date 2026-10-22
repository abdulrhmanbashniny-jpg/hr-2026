import { and, eq, gt, isNull } from 'drizzle-orm';
import { jwtVerify, SignJWT } from 'jose';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { db } from '@/db';
import { craftsmen, sessions, users } from '@/db/schema';
import { hmac } from '@/lib/crypto';
import { env, isProduction } from '@/lib/env';
import { clientIp } from '@/lib/http';
import type { Tier } from '@/lib/incentives/engine';
import type { UserRole } from './roles';

export const SESSION_COOKIE = 'hirfa_session';
export const DEVICE_COOKIE = 'hirfa_did';
const SESSION_DAYS = 30;

function secret() {
  return new TextEncoder().encode(env.authSecret);
}

export async function deviceId(): Promise<string | null> {
  const v = (await cookies()).get(DEVICE_COOKIE)?.value;
  return v && /^[A-Za-z0-9_-]{16,64}$/.test(v) ? v : null;
}

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const h = await headers();
  const ip = await clientIp();
  const [row] = await db
    .insert(sessions)
    .values({ userId, expiresAt, userAgent: h.get('user-agent')?.slice(0, 300) ?? null, ipHash: ip ? hmac(ip, 'ip') : null, deviceId: await deviceId() })
    .returning({ id: sessions.id });
  const token = await new SignJWT({ sid: row.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: isProduction, sameSite: 'lax', path: '/', expires: expiresAt });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
}

async function readSessionId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    return typeof payload.sid === 'string' ? payload.sid : null;
  } catch {
    return null;
  }
}

export async function destroySession() {
  const sid = await readSessionId();
  if (sid) await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sid));
  (await cookies()).delete(SESSION_COOKIE);
}

export interface SessionContext {
  sessionId: string;
  user: { id: string; phone: string; name: string | null; role: UserRole; locale: string; suspended: boolean };
  craftsman: { id: string; referralCode: string; displayName: string; tier: Tier; cityId: string; avatarKey: string | null; createdAt: Date } | null;
}

/** The signed-in user and their craftsman profile, if any. Memoised per request. */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const sid = await readSessionId();
  if (!sid) return null;
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sid), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())));
  if (!row) return null;
  const [c] = await db
    .select({ id: craftsmen.id, referralCode: craftsmen.referralCode, displayName: craftsmen.displayName, tier: craftsmen.tier, cityId: craftsmen.cityId, avatarKey: craftsmen.avatarKey, createdAt: craftsmen.createdAt })
    .from(craftsmen)
    .where(eq(craftsmen.userId, row.user.id));
  return {
    sessionId: row.session.id,
    user: { id: row.user.id, phone: row.user.phone, name: row.user.name, role: row.user.role, locale: row.user.locale, suspended: row.user.status === 'suspended' },
    craftsman: c ?? null,
  };
});

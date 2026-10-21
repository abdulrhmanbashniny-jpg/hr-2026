import { and, eq, gt, isNull } from 'drizzle-orm';
import { jwtVerify, SignJWT } from 'jose';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { db } from '@/db';
import { memberships, sessions, subscriptions, tenants, users } from '@/db/schema';
import { env } from '@/lib/env';
import { resolveSettings } from '@/lib/settings';
import { subscriptionState } from '@/lib/billing/state';
import type { Role } from './rbac';
import { staffCan, staffRoleOf, type StaffRole } from '@/lib/admin/staff';

export const SESSION_COOKIE = 'mutabaa_session';
const SESSION_DAYS = 30;

function secret() {
  return new TextEncoder().encode(env.authSecret);
}

export async function clientIp(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
  } catch {
    return null;
  }
}

export async function createSession(userId: string, tenantId: string | null) {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const h = await headers();
  const [row] = await db
    .insert(sessions)
    .values({ userId, tenantId, expiresAt, userAgent: h.get('user-agent')?.slice(0, 300) ?? null, ip: await clientIp() })
    .returning({ id: sessions.id });
  const token = await new SignJWT({ sid: row.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
}

async function readSessionId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
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

export async function setActiveTenant(tenantId: string | null) {
  const sid = await readSessionId();
  if (sid) await db.update(sessions).set({ tenantId }).where(eq(sessions.id, sid));
}

export interface SessionContext {
  sessionId: string;
  user: { id: string; email: string; name: string; phone: string | null; isSuperAdmin: boolean; staffRole: StaffRole | null; locale: string };
  tenant: { id: string; name: string; slug: string; crNumber: string | null; suspended: boolean } | null;
  role: Role | null;
  settings: ReturnType<typeof resolveSettings>;
  subscription: ReturnType<typeof subscriptionState> | null;
  memberships: { tenantId: string; tenantName: string; role: Role }[];
  /** A platform admin inside a customer's workspace without being a member (support access). */
  supportMode: boolean;
}

/** Loads the signed-in user, their active tenant and role. Memoised per request. */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const sid = await readSessionId();
  if (!sid) return null;
  const [s] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sid), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())));
  if (!s) return null;
  const [user] = await db.select().from(users).where(eq(users.id, s.userId));
  if (!user || user.disabledAt) return null;

  const ms = await db
    .select({ tenantId: memberships.tenantId, role: memberships.role, tenantName: tenants.name })
    .from(memberships)
    .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
    .where(eq(memberships.userId, user.id));

  const member = ms.find((m) => m.tenantId === s.tenantId);
  // Support access is re-checked on every request against the current role, so taking away
  // tenants:enter (role change, removal from the team) ends it even in sessions opened earlier.
  const supportMode = !member && !!s.tenantId && staffCan(staffRoleOf(user), 'tenants:enter');
  const activeId = member?.tenantId ?? (supportMode ? s.tenantId : (ms[0]?.tenantId ?? null));
  let tenant: SessionContext['tenant'] = null;
  let settings = resolveSettings(null);
  let subscription: SessionContext['subscription'] = null;
  if (activeId) {
    const [t] = await db.select().from(tenants).where(eq(tenants.id, activeId));
    if (t) {
      tenant = { id: t.id, name: t.name, slug: t.slug, crNumber: t.crNumber, suspended: !!t.suspendedAt };
      settings = resolveSettings(t.settings);
      const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.tenantId, t.id));
      subscription = sub ? subscriptionState(sub) : null;
    }
  }
  return {
    sessionId: s.id,
    user: { id: user.id, email: user.email, name: user.name, phone: user.phone, isSuperAdmin: user.isSuperAdmin, staffRole: staffRoleOf(user), locale: user.locale },
    tenant,
    role: supportMode && tenant ? 'owner' : ((ms.find((m) => m.tenantId === activeId)?.role as Role | undefined) ?? null),
    settings,
    subscription,
    memberships: ms.map((m) => ({ tenantId: m.tenantId, tenantName: m.tenantName, role: m.role as Role })),
    supportMode: supportMode && !!tenant,
  };
});

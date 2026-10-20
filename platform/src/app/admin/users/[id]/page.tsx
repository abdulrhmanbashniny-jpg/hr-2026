import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { UserConsole, type UserDetailVM } from '@/components/admin/user-console';
import { db } from '@/db';
import { auditLogs, memberships, sessions, tenants, users } from '@/db/schema';
import { staffAbilities } from '@/lib/admin/staff';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { getI18n } from '@/lib/i18n';

export async function generateMetadata(props: PageProps<'/admin/users/[id]'>) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return {};
  const [row] = await db.select({ name: users.name }).from(users).where(eq(users.id, id));
  return { title: row?.name };
}

export default async function AdminUser(props: PageProps<'/admin/users/[id]'>) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await requireSuperAdmin('users:view');
  const { t } = await getI18n();
  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) notFound();
  const [ms, ss, activity] = await Promise.all([
    db.select({ tenantId: tenants.id, tenantName: tenants.name, role: memberships.role }).from(memberships).innerJoin(tenants, eq(tenants.id, memberships.tenantId)).where(eq(memberships.userId, id)),
    db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, id), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
      .orderBy(desc(sessions.createdAt))
      .limit(20),
    db.select({ a: auditLogs, tenant: tenants.name }).from(auditLogs).leftJoin(tenants, eq(tenants.id, auditLogs.tenantId)).where(eq(auditLogs.userId, id)).orderBy(desc(auditLogs.createdAt)).limit(12),
  ]);
  const vm: UserDetailVM = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    isSuperAdmin: user.isSuperAdmin,
    disabled: !!user.disabledAt,
    isSelf: user.id === s.user.id,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    memberships: ms,
    sessions: ss.map((x) => ({ id: x.id, userAgent: x.userAgent, ip: x.ip, createdAt: x.createdAt.toISOString(), current: x.id === s.sessionId })),
    activity: activity.map(({ a, tenant }) => ({ id: a.id, summary: a.summary, tenant, createdAt: a.createdAt.toISOString() })),
  };
  // Team members' accounts are handled only by those who manage the team.
  const can = staffAbilities(s.user.staffRole);
  if (user.isSuperAdmin && !vm.isSelf && !can['team:manage']) Object.assign(can, { 'users:manage': false, 'users:support': false });
  return (
    <>
      <Link href="/admin/users" className="ui-btn ui-btn--ghost ui-btn--sm self-start">
        <ChevronRight size={16} className="ltr:rotate-180" />
        {t.console.users.back}
      </Link>
      <UserConsole vm={vm} can={can} />
    </>
  );
}

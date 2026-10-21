import { and, asc, desc, eq, gt, isNull } from 'drizzle-orm';
import { TeamConsole } from '@/components/admin/team-console';
import { PageHead } from '@/components/ui/card';
import { db } from '@/db';
import { staffInvites, users } from '@/db/schema';
import { isStaffRole, staffRoleOf, type StaffRole } from '@/lib/admin/staff';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { getI18n } from '@/lib/i18n';

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.console.team.title };
}

export default async function AdminTeam(props: PageProps<'/admin/team'>) {
  const s = await requireSuperAdmin('team:manage');
  const { t } = await getI18n();
  const sp = await props.searchParams;
  const inviteEmail = typeof sp.invite === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sp.invite) ? sp.invite.toLowerCase() : '';
  const [rows, invites] = await Promise.all([
    db.select().from(users).where(eq(users.isSuperAdmin, true)).orderBy(asc(users.createdAt)),
    db
      .select()
      .from(staffInvites)
      .where(and(isNull(staffInvites.acceptedAt), isNull(staffInvites.revokedAt), gt(staffInvites.expiresAt, new Date())))
      .orderBy(desc(staffInvites.createdAt)),
  ]);
  return (
    <>
      <PageHead eyebrow={t.console.nav.groupPlatform} title={t.console.team.title} sub={t.console.team.sub} />
      <TeamConsole
        inviteEmail={inviteEmail}
        invites={invites.filter((i) => isStaffRole(i.role)).map((i) => ({ id: i.id, email: i.email, role: i.role as StaffRole, expiresAt: i.expiresAt.toISOString() }))}
        rows={rows.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: staffRoleOf(u) ?? 'owner',
          lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
          disabled: !!u.disabledAt,
          isSelf: u.id === s.user.id,
        }))}
      />
    </>
  );
}

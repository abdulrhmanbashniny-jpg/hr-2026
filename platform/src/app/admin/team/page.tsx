import { asc, eq } from 'drizzle-orm';
import { TeamConsole } from '@/components/admin/team-console';
import { PageHead } from '@/components/ui/card';
import { db } from '@/db';
import { users } from '@/db/schema';
import { staffRoleOf } from '@/lib/admin/staff';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { getI18n } from '@/lib/i18n';

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.console.team.title };
}

export default async function AdminTeam() {
  const s = await requireSuperAdmin('team:manage');
  const { t } = await getI18n();
  const rows = await db.select().from(users).where(eq(users.isSuperAdmin, true)).orderBy(asc(users.createdAt));
  return (
    <>
      <PageHead eyebrow={t.console.nav.groupPlatform} title={t.console.team.title} sub={t.console.team.sub} />
      <TeamConsole
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

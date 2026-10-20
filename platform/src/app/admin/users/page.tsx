import { desc, eq } from 'drizzle-orm';
import { UsersTable, type UserRowVM } from '@/components/admin/users-table';
import { Card, PageHead } from '@/components/ui/card';
import { db } from '@/db';
import { memberships, tenants, users } from '@/db/schema';
import { countOf, f, getI18n } from '@/lib/i18n';

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.console.users.title };
}

export default async function AdminUsers() {
  const { t, locale } = await getI18n();
  const [rows, ms] = await Promise.all([
    db.select().from(users).orderBy(desc(users.createdAt)),
    db.select({ userId: memberships.userId, tenantId: tenants.id, name: tenants.name }).from(memberships).innerJoin(tenants, eq(tenants.id, memberships.tenantId)),
  ]);
  const byUser = new Map<string, string[]>();
  for (const m of ms) byUser.set(m.userId, [...(byUser.get(m.userId) ?? []), m.name]);
  const vm: UserRowVM[] = rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    companies: byUser.get(u.id) ?? [],
    isSuperAdmin: u.isSuperAdmin,
    disabled: !!u.disabledAt,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  }));
  return (
    <>
      <PageHead title={t.console.users.title} sub={f(t.console.users.sub, { users: countOf(rows.length, 'user', locale), companies: countOf(new Set(ms.map((m) => m.tenantId)).size, 'company', locale) })} />
      <Card flat>
        <UsersTable rows={vm} />
      </Card>
    </>
  );
}

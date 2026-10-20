import { desc, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { AuditTable, type AuditVM } from '@/components/audit/audit-table';
import { Card, PageHead } from '@/components/ui/card';
import { db } from '@/db';
import { auditLogs, users } from '@/db/schema';
import { requireTenant } from '@/lib/auth/guards';
import { can } from '@/lib/auth/rbac';
import { getI18n } from '@/lib/i18n';

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.audit.title };
}

export default async function AuditPage() {
  const s = await requireTenant();
  if (!can(s.role, 'audit:read')) redirect('/app');
  const { t } = await getI18n();
  const rows = await db
    .select({ a: auditLogs, userName: users.name, email: users.email })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .where(eq(auditLogs.tenantId, s.tenant.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(3000);
  const vm: AuditVM[] = rows.map(({ a, userName, email }) => ({
    id: a.id,
    at: a.createdAt.toISOString(),
    user: userName ?? (a.action.includes('telegram') ? t.audit.bot : t.audit.system),
    email,
    action: a.action,
    entity: a.entityType,
    summary: a.summary,
    ip: a.ip,
  }));
  return (
    <>
      <PageHead title={t.audit.title} sub={t.audit.subtitle} />
      <Card flat>
        <AuditTable rows={vm} />
      </Card>
    </>
  );
}

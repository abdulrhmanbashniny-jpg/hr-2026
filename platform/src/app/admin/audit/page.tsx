import { desc, eq } from 'drizzle-orm';
import { AuditConsole } from '@/components/admin/audit-console';
import { Card, PageHead } from '@/components/ui/card';
import { db } from '@/db';
import { auditLogs, tenants, users } from '@/db/schema';
import { getI18n } from '@/lib/i18n';
import { requireSuperAdmin } from '@/lib/auth/guards';

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.console.audit.title };
}

export default async function AdminAudit() {
  await requireSuperAdmin('audit:view');
  const { t } = await getI18n();
  const rows = await db
    .select({ a: auditLogs, tenant: tenants.name, user: users.name })
    .from(auditLogs)
    .leftJoin(tenants, eq(tenants.id, auditLogs.tenantId))
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(2000);
  return (
    <>
      <PageHead title={t.console.audit.title} sub={t.console.audit.sub} />
      <Card flat>
        <AuditConsole rows={rows.map(({ a, tenant, user }) => ({ id: a.id, createdAt: a.createdAt.toISOString(), action: a.action, summary: a.summary, tenant, tenantId: a.tenantId, user, ip: a.ip }))} />
      </Card>
    </>
  );
}

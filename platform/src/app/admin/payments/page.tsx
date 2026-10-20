import { desc, eq } from 'drizzle-orm';
import { PaymentsTable } from '@/components/admin/catalog';
import { Card, PageHead } from '@/components/ui/card';
import { db } from '@/db';
import { payments, plans, tenants } from '@/db/schema';
import { getI18n } from '@/lib/i18n';

export default async function AdminPayments() {
  const { t, locale } = await getI18n();
  const rows = await db
    .select({ p: payments, tenant: tenants.name, planAr: plans.nameAr, planEn: plans.nameEn })
    .from(payments)
    .innerJoin(tenants, eq(tenants.id, payments.tenantId))
    .leftJoin(plans, eq(plans.id, payments.planId))
    .orderBy(desc(payments.createdAt))
    .limit(500);
  return (
    <>
      <PageHead title={t.admin.payments} />
      <Card flat>
        <PaymentsTable
          rows={rows.map(({ p, tenant, planAr, planEn }) => ({
            id: p.id,
            tenant,
            plan: (locale === 'ar' ? planAr : planEn) ?? '—',
            cycle: p.billingCycle,
            total: p.total,
            discount: p.discount,
            provider: p.provider,
            status: p.status,
            createdAt: p.createdAt.toISOString(),
          }))}
        />
      </Card>
    </>
  );
}

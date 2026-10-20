import { asc, count, desc, eq } from 'drizzle-orm';
import { Building2, CreditCard, Hourglass, Wallet } from 'lucide-react';
import { TenantsTable, type TenantVM } from '@/components/admin/tenants-table';
import { Card, PageHead } from '@/components/ui/card';
import { Kpi } from '@/components/ui/kpi';
import { db } from '@/db';
import { memberships, plans, subscriptions, tenants } from '@/db/schema';
import { subscriptionState } from '@/lib/billing/state';
import { fmtNumber, getI18n } from '@/lib/i18n';

export default async function AdminOverview() {
  const { t, locale } = await getI18n();
  const [rows, subs, planRows, memberCounts] = await Promise.all([
    db.select().from(tenants).orderBy(desc(tenants.createdAt)),
    db.select().from(subscriptions),
    db.select().from(plans).orderBy(asc(plans.sortOrder)),
    db.select({ tenantId: memberships.tenantId, n: count() }).from(memberships).groupBy(memberships.tenantId),
  ]);
  const subBy = new Map(subs.map((s) => [s.tenantId, s]));
  const planBy = new Map(planRows.map((p) => [p.id, p]));
  const members = new Map(memberCounts.map((m) => [m.tenantId, m.n]));
  const active = subs.filter((s) => s.status === 'active');
  const mrr = active.reduce((sum, s) => {
    const p = s.planId ? planBy.get(s.planId) : undefined;
    if (!p) return sum;
    return sum + (s.billingCycle === 'yearly' ? p.priceYearly / 12 : p.priceMonthly);
  }, 0);
  const vm: TenantVM[] = rows.map((tn) => {
    const sub = subBy.get(tn.id);
    const st = sub ? subscriptionState(sub) : null;
    const plan = sub?.planId ? planBy.get(sub.planId) : undefined;
    return {
      id: tn.id,
      name: tn.name,
      crNumber: tn.crNumber,
      createdAt: tn.createdAt.toISOString(),
      status: sub?.status ?? null,
      daysLeft: st?.daysLeft ?? null,
      plan: plan ? (locale === 'ar' ? plan.nameAr : plan.nameEn) : null,
      members: members.get(tn.id) ?? 0,
      suspended: !!tn.suspendedAt,
    };
  });
  const i = { size: 16 };
  return (
    <>
      <PageHead title={t.admin.title} />
      <div className="kpi-grid">
        <Kpi icon={<Building2 {...i} />} label={t.admin.totalTenants} value={fmtNumber(rows.length)} />
        <Kpi icon={<CreditCard {...i} />} label={t.admin.activeSubs} value={fmtNumber(active.length)} />
        <Kpi icon={<Hourglass {...i} />} label={t.admin.trials} value={fmtNumber(subs.filter((s) => s.status === 'trialing').length)} />
        <Kpi icon={<Wallet {...i} />} label={t.admin.mrr} value={fmtNumber(mrr / 100)} foot={t.common.sar} />
      </div>
      <Card title={t.admin.tenants} flat>
        <TenantsTable rows={vm} plans={planRows.map((p) => ({ id: p.id, name: locale === 'ar' ? p.nameAr : p.nameEn }))} />
      </Card>
    </>
  );
}

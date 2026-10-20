import { count, desc, eq, max, sql } from 'drizzle-orm';
import { TenantsTable, type TenantVM } from '@/components/admin/tenants-table';
import type { SubStatusKey } from '@/components/admin/status';
import { Card, PageHead } from '@/components/ui/card';
import { db } from '@/db';
import { auditLogs, documents, gosiSubscribers, memberships, plans, residents, subscriptions, tenants, users, vehicles } from '@/db/schema';
import { countOf, f, getI18n } from '@/lib/i18n';
import { requireSuperAdmin } from '@/lib/auth/guards';

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.console.tenants.title };
}

const DAY = 86_400_000;

async function countBy(table: typeof residents | typeof gosiSubscribers | typeof vehicles | typeof documents) {
  const rows = await db.select({ tenantId: table.tenantId, n: count() }).from(table).groupBy(table.tenantId);
  return new Map(rows.map((r) => [r.tenantId, r.n]));
}

export default async function AdminTenants() {
  await requireSuperAdmin('tenants:view');
  const { t, locale } = await getI18n();
  const [rows, subs, planRows, memberCounts, owners, lastSeen, res, gosi, veh, docs] = await Promise.all([
    db.select().from(tenants).orderBy(desc(tenants.createdAt)),
    db.select().from(subscriptions),
    db.select().from(plans),
    db.select({ tenantId: memberships.tenantId, n: count() }).from(memberships).groupBy(memberships.tenantId),
    db.select({ tenantId: memberships.tenantId, email: users.email }).from(memberships).innerJoin(users, eq(users.id, memberships.userId)).where(eq(memberships.role, 'owner')).orderBy(memberships.createdAt),
    db.select({ tenantId: auditLogs.tenantId, at: max(auditLogs.createdAt) }).from(auditLogs).where(sql`${auditLogs.tenantId} is not null`).groupBy(auditLogs.tenantId),
    countBy(residents),
    countBy(gosiSubscribers),
    countBy(vehicles),
    countBy(documents),
  ]);
  const subBy = new Map(subs.map((s) => [s.tenantId, s]));
  const planBy = new Map(planRows.map((p) => [p.id, p]));
  const members = new Map(memberCounts.map((m) => [m.tenantId, m.n]));
  const ownerBy = new Map<string, string>();
  for (const o of owners) if (!ownerBy.has(o.tenantId)) ownerBy.set(o.tenantId, o.email);
  const seen = new Map(lastSeen.map((l) => [l.tenantId!, l.at]));
  const now = Date.now();
  const vm: TenantVM[] = rows.map((tn) => {
    const sub = subBy.get(tn.id);
    const plan = sub?.planId ? planBy.get(sub.planId) : undefined;
    const renewal = sub?.status === 'trialing' ? sub.trialEndsAt : sub?.currentPeriodEnd ?? null;
    return {
      id: tn.id,
      name: tn.name,
      crNumber: tn.crNumber,
      createdAt: tn.createdAt.toISOString(),
      status: (sub?.status as SubStatusKey | undefined) ?? 'none',
      plan: plan ? (locale === 'ar' ? plan.nameAr : plan.nameEn) : null,
      cycle: sub?.planId ? sub.billingCycle : null,
      renewalAt: renewal?.toISOString() ?? null,
      daysLeft: renewal ? Math.ceil((renewal.getTime() - now) / DAY) : null,
      members: members.get(tn.id) ?? 0,
      records: (res.get(tn.id) ?? 0) + (gosi.get(tn.id) ?? 0) + (veh.get(tn.id) ?? 0) + (docs.get(tn.id) ?? 0),
      lastActive: seen.get(tn.id)?.toISOString() ?? null,
      suspended: !!tn.suspendedAt,
      owner: ownerBy.get(tn.id) ?? null,
    };
  });
  return (
    <>
      <PageHead title={t.console.tenants.title} sub={f(t.console.tenants.sub, { companies: countOf(rows.length, 'company', locale) })} />
      <Card flat>
        <TenantsTable rows={vm} />
      </Card>
    </>
  );
}

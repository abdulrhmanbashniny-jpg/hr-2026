import { and, count, desc, eq, gte, isNotNull } from 'drizzle-orm';
import { db } from '@/db';
import { auditLogs, complianceAlerts, documents, gosiSubscribers, memberships, payments, plans, residents, subscriptions, tenants, users, vehicles } from '@/db/schema';

const DAY = 86_400_000;

export type SubStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | 'none';

/** Monthly value of one subscription in halalas (yearly prices spread over 12 months). */
export function monthlyValue(sub: { status: string; billingCycle: string }, plan: { priceMonthly: number; priceYearly: number } | undefined): number {
  if (!plan || (sub.status !== 'active' && sub.status !== 'past_due')) return 0;
  return sub.billingCycle === 'yearly' ? Math.round(plan.priceYearly / 12) : plan.priceMonthly;
}

/** Riyadh calendar month key (YYYY-MM) of an instant. */
function monthKey(d: Date): string {
  const r = new Date(d.getTime() + 3 * 3_600_000);
  return `${r.getUTCFullYear()}-${String(r.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function platformOverview(now = new Date()) {
  const [tenantRows, subRows, planRows, paidRows, pendingRows, memberCounts, usage, recentAudit] = await Promise.all([
    db.select().from(tenants).orderBy(desc(tenants.createdAt)),
    db.select().from(subscriptions),
    db.select().from(plans),
    db.select({ total: payments.total, paidAt: payments.paidAt }).from(payments).where(and(eq(payments.status, 'paid'), isNotNull(payments.paidAt), gte(payments.paidAt, new Date(now.getTime() - 400 * DAY)))),
    db
      .select({ id: payments.id, tenantId: payments.tenantId, total: payments.total, provider: payments.provider, createdAt: payments.createdAt, tenant: tenants.name, planId: payments.planId, cycle: payments.billingCycle })
      .from(payments)
      .innerJoin(tenants, eq(tenants.id, payments.tenantId))
      .where(eq(payments.status, 'pending'))
      .orderBy(desc(payments.createdAt))
      .limit(8),
    db.select({ tenantId: memberships.tenantId, n: count() }).from(memberships).groupBy(memberships.tenantId),
    Promise.all([
      db.select({ n: count() }).from(residents),
      db.select({ n: count() }).from(gosiSubscribers),
      db.select({ n: count() }).from(vehicles),
      db.select({ n: count() }).from(documents),
      db.select({ n: count() }).from(complianceAlerts).where(eq(complianceAlerts.status, 'open')),
      db.select({ n: count() }).from(users),
    ]),
    db
      .select({ id: auditLogs.id, summary: auditLogs.summary, action: auditLogs.action, createdAt: auditLogs.createdAt, tenant: tenants.name, tenantId: auditLogs.tenantId, user: users.name })
      .from(auditLogs)
      .leftJoin(tenants, eq(tenants.id, auditLogs.tenantId))
      .leftJoin(users, eq(users.id, auditLogs.userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(8),
  ]);

  const planBy = new Map(planRows.map((p) => [p.id, p]));
  const subBy = new Map(subRows.map((s) => [s.tenantId, s]));
  const statusOf = (tenantId: string): SubStatus => (subBy.get(tenantId)?.status as SubStatus | undefined) ?? 'none';

  // Recurring revenue
  let mrr = 0;
  let monthlyN = 0;
  let yearlyN = 0;
  const mrrByPlan = new Map<string, number>();
  for (const s of subRows) {
    const plan = s.planId ? planBy.get(s.planId) : undefined;
    const v = monthlyValue(s, plan);
    if (!v) continue;
    mrr += v;
    if (s.billingCycle === 'yearly') yearlyN++;
    else monthlyN++;
    mrrByPlan.set(s.planId!, (mrrByPlan.get(s.planId!) ?? 0) + v);
  }

  // Status mix
  const mix: Record<SubStatus | 'suspended', number> = { trialing: 0, active: 0, past_due: 0, canceled: 0, expired: 0, none: 0, suspended: 0 };
  for (const t of tenantRows) {
    mix[statusOf(t.id)]++;
    if (t.suspendedAt) mix.suspended++;
  }
  const decided = mix.active + mix.past_due + mix.expired + mix.canceled;
  const conversion = decided ? ((mix.active + mix.past_due) / decided) * 100 : null;

  // Trials ending within 7 days
  const trialsEnding = subRows
    .filter((s) => s.status === 'trialing' && s.trialEndsAt && s.trialEndsAt.getTime() - now.getTime() <= 7 * DAY)
    .map((s) => ({ tenantId: s.tenantId, name: tenantRows.find((t) => t.id === s.tenantId)?.name ?? '—', daysLeft: Math.max(0, Math.ceil((s.trialEndsAt!.getTime() - now.getTime()) / DAY)) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // New companies
  const created = (from: number, to: number) => tenantRows.filter((t) => t.createdAt.getTime() >= now.getTime() - from * DAY && t.createdAt.getTime() < now.getTime() - to * DAY).length;

  // Revenue per month (12 calendar months, oldest first)
  const months: { key: string; value: number }[] = [];
  const r = new Date(now.getTime() + 3 * 3_600_000);
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() - i, 1));
    months.push({ key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, value: 0 });
  }
  const byMonth = new Map(months.map((m) => [m.key, m]));
  for (const p of paidRows) {
    const m = byMonth.get(monthKey(p.paidAt!));
    if (m) m.value += p.total;
  }
  const revenue30 = paidRows.filter((p) => p.paidAt!.getTime() >= now.getTime() - 30 * DAY);

  // Sign-ups per week (12 weeks, oldest first)
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const end = now.getTime() - (11 - i) * 7 * DAY;
    const start = end - 7 * DAY;
    return { start: new Date(start), value: tenantRows.filter((t) => t.createdAt.getTime() > start && t.createdAt.getTime() <= end).length };
  });

  const members = new Map(memberCounts.map((m) => [m.tenantId, m.n]));
  const [[residentsN], [gosiN], [vehiclesN], [documentsN], [alertsN], [usersN]] = usage;

  return {
    tenantsTotal: tenantRows.length,
    mrr,
    arr: mrr * 12,
    paidCount: monthlyN + yearlyN,
    monthlyN,
    yearlyN,
    mix,
    conversion,
    trialsEnding,
    newTenants30: created(30, 0),
    newTenantsPrev30: created(60, 30),
    revenue30: revenue30.reduce((sum, p) => sum + p.total, 0),
    revenue30Count: revenue30.length,
    months,
    weeks,
    mrrByPlan: planRows
      .map((p) => ({ id: p.id, nameAr: p.nameAr, nameEn: p.nameEn, value: mrrByPlan.get(p.id) ?? 0, count: subRows.filter((s) => s.planId === p.id && (s.status === 'active' || s.status === 'past_due')).length }))
      .sort((a, b) => b.value - a.value),
    pending: pendingRows,
    recent: tenantRows.slice(0, 6).map((t) => ({ id: t.id, name: t.name, createdAt: t.createdAt, status: statusOf(t.id), members: members.get(t.id) ?? 0, suspended: !!t.suspendedAt })),
    usage: { residents: residentsN.n, gosi: gosiN.n, vehicles: vehiclesN.n, documents: documentsN.n, alerts: alertsN.n, users: usersN.n },
    activity: recentAudit,
    planBy,
  };
}

import { and, asc, count, desc, eq, max } from 'drizzle-orm';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { SubStatusKey } from '@/components/admin/status';
import { TenantConsole, type TenantDetailVM } from '@/components/admin/tenant-console';
import { db } from '@/db';
import {
  announcements,
  auditLogs,
  complianceAlerts,
  documents,
  driverCards,
  gosiSubscribers,
  importBatches,
  memberships,
  operatingCards,
  payments,
  plans,
  residents,
  subscriptions,
  tenantNotes,
  tenants,
  users,
  vehicles,
} from '@/db/schema';
import type { Role } from '@/lib/auth/rbac';
import { formatSar } from '@/lib/billing/pricing';
import { getI18n } from '@/lib/i18n';
import { emailEnabled } from '@/lib/notifications/email';
import { staffAbilities } from '@/lib/admin/staff';
import { requireSuperAdmin } from '@/lib/auth/guards';

export async function generateMetadata(props: PageProps<'/admin/tenants/[id]'>) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return {};
  const [row] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, id));
  return { title: row?.name };
}

export default async function AdminTenant(props: PageProps<'/admin/tenants/[id]'>) {
  const me = await requireSuperAdmin('tenants:view');
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { t, locale } = await getI18n();
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
  if (!tenant) notFound();
  const n = (rows: { n: number }[]) => rows[0]?.n ?? 0;
  const [[sub], planRows, members, usage, paymentRows, notes, activity, messageRows] = await Promise.all([
    db.select().from(subscriptions).where(eq(subscriptions.tenantId, id)),
    db.select().from(plans).orderBy(asc(plans.sortOrder)),
    db
      .select({ membershipId: memberships.id, role: memberships.role, user: users })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.tenantId, id))
      .orderBy(asc(memberships.createdAt)),
    Promise.all([
      db.select({ n: count() }).from(residents).where(eq(residents.tenantId, id)),
      db.select({ n: count() }).from(gosiSubscribers).where(eq(gosiSubscribers.tenantId, id)),
      db.select({ n: count() }).from(vehicles).where(eq(vehicles.tenantId, id)),
      db.select({ n: count() }).from(operatingCards).where(eq(operatingCards.tenantId, id)),
      db.select({ n: count() }).from(driverCards).where(eq(driverCards.tenantId, id)),
      db.select({ n: count() }).from(documents).where(eq(documents.tenantId, id)),
      db.select({ n: count() }).from(complianceAlerts).where(and(eq(complianceAlerts.tenantId, id), eq(complianceAlerts.status, 'open'))),
      db.select({ n: count(), last: max(importBatches.createdAt) }).from(importBatches).where(eq(importBatches.tenantId, id)),
    ]),
    db.select({ p: payments, planAr: plans.nameAr, planEn: plans.nameEn }).from(payments).leftJoin(plans, eq(plans.id, payments.planId)).where(eq(payments.tenantId, id)).orderBy(desc(payments.createdAt)).limit(24),
    db.select({ note: tenantNotes, author: users.name }).from(tenantNotes).leftJoin(users, eq(users.id, tenantNotes.authorId)).where(eq(tenantNotes.tenantId, id)).orderBy(desc(tenantNotes.createdAt)),
    db.select({ a: auditLogs, user: users.name }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.userId)).where(eq(auditLogs.tenantId, id)).orderBy(desc(auditLogs.createdAt)).limit(15),
    db.select().from(announcements).orderBy(desc(announcements.createdAt)).limit(200),
  ]);
  const plan = sub?.planId ? planRows.find((p) => p.id === sub.planId) : undefined;
  const [res, gosi, veh, op, drv, docs, alerts, imports] = usage;
  const u = t.console.overview;

  const vm: TenantDetailVM = {
    id: tenant.id,
    name: tenant.name,
    crNumber: tenant.crNumber,
    createdAt: tenant.createdAt.toISOString(),
    suspended: !!tenant.suspendedAt,
    status: (sub?.status as SubStatusKey | undefined) ?? 'none',
    planId: sub?.planId ?? null,
    planName: plan ? (locale === 'ar' ? plan.nameAr : plan.nameEn) : null,
    cycle: sub?.billingCycle ?? 'monthly',
    trialEndsAt: sub?.trialEndsAt?.toISOString() ?? null,
    periodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
    members: members.map((m) => ({ membershipId: m.membershipId, userId: m.user.id, name: m.user.name, email: m.user.email, role: m.role as Role, lastLoginAt: m.user.lastLoginAt?.toISOString() ?? null, disabled: !!m.user.disabledAt })),
    usage: [
      { label: u.usageResidents, value: n(res) },
      { label: u.usageGosi, value: n(gosi) },
      { label: u.usageVehicles, value: n(veh) },
      { label: t.nav.operatingCards, value: n(op) },
      { label: t.nav.driverCards, value: n(drv) },
      { label: u.usageDocuments, value: n(docs) },
      { label: u.usageAlerts, value: n(alerts) },
      { label: t.nav.imports, value: imports[0]?.n ?? 0 },
    ],
    payments: paymentRows.map(({ p, planAr, planEn }) => ({ id: p.id, total: formatSar(p.total, locale), status: p.status, provider: p.provider, createdAt: p.createdAt.toISOString(), plan: `${(locale === 'ar' ? planAr : planEn) ?? '—'} · ${t.console.cycle[p.billingCycle]}` })),
    notes: notes.map(({ note, author }) => ({ id: note.id, body: note.body, author, createdAt: note.createdAt.toISOString() })),
    activity: activity.map(({ a, user }) => ({ id: a.id, summary: a.summary, user, createdAt: a.createdAt.toISOString(), admin: a.action.startsWith('admin.') })),
    messages: messageRows
      .filter((m) => m.audience.kind === 'all' || (m.audience.kind === 'tenants' && m.audience.tenantIds?.includes(id)))
      .slice(0, 10)
      .map((m) => ({ id: m.id, title: m.title, createdAt: m.createdAt.toISOString(), channels: m.channels })),
    emailEnabled: await emailEnabled(null),
  };

  return (
    <>
      <Link href="/admin/tenants" className="ui-btn ui-btn--ghost ui-btn--sm self-start">
        <ChevronRight size={16} className="ltr:rotate-180" />
        {t.console.tenants.back}
      </Link>
      <TenantConsole vm={vm} plans={planRows.map((p) => ({ id: p.id, name: locale === 'ar' ? p.nameAr : p.nameEn }))} can={staffAbilities(me.user.staffRole)} />
    </>
  );
}

import { and, desc, eq, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { AlertsBoard, type AlertVM } from '@/components/alerts/alerts-board';
import { Card, PageHead } from '@/components/ui/card';
import { db } from '@/db';
import { complianceAlerts, contacts, users } from '@/db/schema';
import { requireTenant } from '@/lib/auth/guards';
import { can } from '@/lib/auth/rbac';
import { getI18n } from '@/lib/i18n';
import { RULES } from '@/lib/rules/engine';

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.alerts.title };
}

const STATUSES = ['open', 'acknowledged', 'snoozed', 'resolved'] as const;

export default async function AlertsPage(props: PageProps<'/app/alerts'>) {
  const s = await requireTenant();
  const { t, locale } = await getI18n();
  const sp = await props.searchParams;
  const status = (STATUSES as readonly string[]).includes(String(sp.status)) ? (sp.status as (typeof STATUSES)[number]) : 'open';
  const rows = await db
    .select()
    .from(complianceAlerts)
    .where(and(eq(complianceAlerts.tenantId, s.tenant.id), eq(complianceAlerts.status, status)))
    .orderBy(desc(complianceAlerts.lastSeenAt))
    .limit(2000);
  const countsRaw = await db
    .select({ status: complianceAlerts.status, id: complianceAlerts.id })
    .from(complianceAlerts)
    .where(eq(complianceAlerts.tenantId, s.tenant.id));
  const counts = Object.fromEntries(STATUSES.map((k) => [k, countsRaw.filter((r) => r.status === k).length]));
  const ackIds = [...new Set(rows.map((r) => r.acknowledgedBy).filter((x): x is string => !!x))];
  const ackUsers = ackIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ackIds)) : [];
  const userName = new Map(ackUsers.map((u) => [u.id, u.name]));
  const people = await db.select({ id: contacts.id, name: contacts.name, phone: contacts.phone, modules: contacts.modules }).from(contacts).where(and(eq(contacts.tenantId, s.tenant.id), eq(contacts.isActive, true)));
  const rank = { critical: 0, high: 1, medium: 2, low: 3, info: 4 } as const;
  rows.sort((a, b) => rank[a.severity] - rank[b.severity] || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
  const vm: AlertVM[] = rows.map((a) => ({
    id: a.id,
    ruleCode: a.ruleCode,
    ruleLabel: locale === 'ar' ? (RULES[a.ruleCode as keyof typeof RULES]?.ar ?? a.ruleCode) : (RULES[a.ruleCode as keyof typeof RULES]?.en ?? a.ruleCode),
    module: a.module,
    severity: a.severity,
    title: locale === 'ar' ? a.titleAr : a.titleEn,
    detail: locale === 'ar' ? a.detailAr : a.detailEn,
    detailAr: a.detailAr,
    entityLabel: a.entityLabel,
    link: a.link,
    dueDate: a.dueDate,
    firstSeen: a.firstSeenAt.toISOString(),
    snoozedUntil: a.snoozedUntil?.toISOString() ?? null,
    acknowledgedBy: a.acknowledgedBy ? (userName.get(a.acknowledgedBy) ?? null) : null,
    resolvedReason: a.resolvedReason,
  }));
  const initialSeverity = typeof sp.severity === 'string' ? sp.severity : null;
  return (
    <>
      <PageHead title={t.alerts.title} sub={t.alerts.subtitle} />
      <Card flat>
        <div className="px-5 pt-3">
          <div className="ui-tabs" role="tablist">
            {STATUSES.map((k) => (
              <Link key={k} href={`/app/alerts?status=${k}`} role="tab" aria-selected={status === k} className="ui-tab">
                {t.alerts[k]}
                <span className="ui-tab__count">{counts[k]}</span>
              </Link>
            ))}
          </div>
        </div>
        <AlertsBoard rows={vm} status={status} canManage={can(s.role, 'alerts:manage') && (s.subscription?.canWrite ?? true)} contacts={people} initialSeverity={initialSeverity} />
      </Card>
    </>
  );
}

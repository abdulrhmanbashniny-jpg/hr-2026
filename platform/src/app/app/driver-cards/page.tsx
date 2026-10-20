import { eq } from 'drizzle-orm';
import { Upload } from 'lucide-react';
import Link from 'next/link';
import { CardsTable, type CardVM } from '@/components/records/cards-table';
import { ActiveFilter, StatusTabs } from '@/components/records/status-tabs';
import { Card, Empty, PageHead, Pill } from '@/components/ui/card';
import { ExpiryMatrix } from '@/components/ui/matrix';
import { db } from '@/db';
import { driverCards, gosiSubscribers, residents } from '@/db/schema';
import { matrixOf } from '@/lib/analytics/common';
import { requireTenant } from '@/lib/auth/guards';
import { can } from '@/lib/auth/rbac';
import { bucketFor, daysUntil, todayRiyadh } from '@/lib/dates';
import { getI18n } from '@/lib/i18n';
import { isActiveCardStatus, isRegulatedDriverOccupation } from '@/lib/rules/classify';

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.driverCards.title };
}

export default async function DriverCardsPage(props: PageProps<'/app/driver-cards'>) {
  const s = await requireTenant();
  const { t } = await getI18n();
  const sp = await props.searchParams;
  const status = (['active', 'missing', 'archived'].includes(String(sp.status)) ? sp.status : 'active') as 'active' | 'missing' | 'archived';
  const bucket = typeof sp.bucket === 'string' ? sp.bucket : null;
  const today = todayRiyadh();
  const [cards, res, gosi] = await Promise.all([
    db.select().from(driverCards).where(eq(driverCards.tenantId, s.tenant.id)),
    db.select().from(residents).where(eq(residents.tenantId, s.tenant.id)),
    db.select().from(gosiSubscribers).where(eq(gosiSubscribers.tenantId, s.tenant.id)),
  ]);
  const counts = { active: 0, missing: 0, archived: 0 };
  for (const c of cards) counts[c.recordStatus]++;
  let rows = cards.filter((c) => c.recordStatus === status);
  if (bucket) rows = rows.filter((c) => bucketFor(c.expiryDate, today) === bucket);
  rows.sort((a, b) => (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999'));
  const vm: CardVM[] = rows.map((c) => ({
    id: c.id,
    cardNumber: c.cardNumber,
    holderKey: c.driverId,
    holderLabel: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.driverId,
    holderHref: `/app/people/${c.driverId}`,
    activity: c.activity,
    issueDate: c.issueDate,
    expiryDate: c.expiryDate,
    status: c.requestStatus,
    extra: c.cardClass,
    recordStatus: c.recordStatus,
  }));
  const people = new Map<string, { name: string; occupation: string | null }>();
  for (const g of gosi) if (g.recordStatus === 'active') people.set(g.nationalId, { name: g.name, occupation: g.occupation });
  for (const r of res) if (r.recordStatus === 'active') people.set(r.iqamaNumber, { name: r.name, occupation: r.occupation });
  const activeByDriver = new Set(cards.filter((c) => c.recordStatus === 'active' && isActiveCardStatus(c.requestStatus) && (daysUntil(c.expiryDate, today) ?? 1) > 0).map((c) => c.driverId));
  const needing = [...people].filter(([id, p]) => isRegulatedDriverOccupation(p.occupation, s.settings) && !activeByDriver.has(id));
  const activeCards = cards.filter((c) => c.recordStatus === 'active');
  return (
    <>
      <PageHead
        title={t.driverCards.title}
        sub={t.driverCards.subtitle}
        actions={
          <Link href="/app/imports#driver_cards" className="ui-btn ui-btn--primary">
            <Upload size={18} />
            {t.nav.imports}
          </Link>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <ExpiryMatrix title={t.driverCards.matrix} matrix={matrixOf(activeCards.map((c) => c.expiryDate), today)} t={t} hrefFor={(b) => `/app/driver-cards?bucket=${b}`} active={bucket} />
        <Card title={t.driverCards.missingTitle} sub={t.driverCards.missingSub} flat>
          {needing.length ? (
            <ul>
              {needing.map(([id, p]) => (
                <li key={id} className="flex items-center justify-between gap-3 border-t px-5 py-3 first:border-t-0" style={{ borderColor: 'var(--line-soft)' }}>
                  <Link href={`/app/people/${id}`}>
                    <b>{p.name}</b>
                  </Link>
                  <span className="flex items-center gap-2">
                    <span className="ui-num text-xs text-muted">{id}</span>
                    <Pill tone="red">{p.occupation}</Pill>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{t.common.none}</Empty>
          )}
        </Card>
      </div>
      <Card flat>
        <div className="px-5 pt-3">
          <StatusTabs base="/app/driver-cards" current={status} counts={counts} t={t} />
        </div>
        {bucket ? (
          <div className="px-5 pt-3">
            <ActiveFilter label={`${t.driverCards.expiryDate}: ${t.expiry[bucket as 'd30']}`} clearHref={`/app/driver-cards?status=${status}`} />
          </div>
        ) : null}
        <CardsTable kind="driver_cards" rows={vm} today={today} canEdit={can(s.role, 'people:write') && (s.subscription?.canWrite ?? true)} />
      </Card>
    </>
  );
}

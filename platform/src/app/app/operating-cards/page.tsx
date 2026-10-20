import { eq } from 'drizzle-orm';
import { Upload } from 'lucide-react';
import Link from 'next/link';
import { CardsTable, type CardVM } from '@/components/records/cards-table';
import { ActiveFilter, StatusTabs } from '@/components/records/status-tabs';
import { AddRecordButton } from '@/components/records/record-editor';
import { Card, Empty, PageHead, Pill } from '@/components/ui/card';
import { ExpiryMatrix } from '@/components/ui/matrix';
import { db } from '@/db';
import { operatingCards, vehicles } from '@/db/schema';
import { matrixOf } from '@/lib/analytics/common';
import { requireTenant } from '@/lib/auth/guards';
import { can } from '@/lib/auth/rbac';
import { bucketFor, todayRiyadh } from '@/lib/dates';
import { getI18n } from '@/lib/i18n';
import { operatingCardRequirement } from '@/lib/rules/classify';

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.opCards.title };
}

export default async function OperatingCardsPage(props: PageProps<'/app/operating-cards'>) {
  const s = await requireTenant();
  const { t } = await getI18n();
  const sp = await props.searchParams;
  const status = (['active', 'missing', 'archived'].includes(String(sp.status)) ? sp.status : 'active') as 'active' | 'missing' | 'archived';
  const bucket = typeof sp.bucket === 'string' ? sp.bucket : null;
  const today = todayRiyadh();
  const [cards, fleet] = await Promise.all([
    db.select().from(operatingCards).where(eq(operatingCards.tenantId, s.tenant.id)),
    db.select().from(vehicles).where(eq(vehicles.tenantId, s.tenant.id)),
  ]);
  const vehicleBySeq = new Map(fleet.map((v) => [v.sequenceNumber, v]));
  const counts = { active: 0, missing: 0, archived: 0 };
  for (const c of cards) counts[c.recordStatus]++;
  let rows = cards.filter((c) => c.recordStatus === status);
  if (bucket) rows = rows.filter((c) => bucketFor(c.expiryDate, today) === bucket);
  rows.sort((a, b) => (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999'));
  const vm: CardVM[] = rows.map((c) => {
    const v = c.sequenceNumber ? vehicleBySeq.get(c.sequenceNumber) : undefined;
    return {
      id: c.id,
      cardNumber: c.cardNumber,
      holderKey: c.sequenceNumber,
      holderLabel: v ? [v.plateNumber, v.make, v.model].filter(Boolean).join(' · ') : null,
      holderHref: v ? `/app/fleet/${v.sequenceNumber}` : null,
      activity: c.activity,
      issueDate: c.issueDate,
      expiryDate: c.expiryDate,
      status: c.cardStatus,
      recordStatus: c.recordStatus,
    };
  });
  const withCard = new Set(cards.filter((c) => c.recordStatus === 'active').map((c) => c.sequenceNumber));
  const needing = fleet.filter((v) => v.recordStatus === 'active' && operatingCardRequirement(v, s.settings).required && !withCard.has(v.sequenceNumber));
  const activeCards = cards.filter((c) => c.recordStatus === 'active');
  return (
    <>
      <PageHead
        title={t.opCards.title}
        sub={t.opCards.subtitle}
        actions={
          <>
            <AddRecordButton kind="operating_cards" canEdit={can(s.role, 'fleet:write') && (s.subscription?.canWrite ?? true)} />
            <Link href="/app/imports#operating_cards" className="ui-btn ui-btn--primary">
              <Upload size={18} />
              {t.nav.imports}
            </Link>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <ExpiryMatrix title={t.opCards.matrix} matrix={matrixOf(activeCards.map((c) => c.expiryDate), today)} t={t} hrefFor={(b) => `/app/operating-cards?bucket=${b}`} active={bucket} />
        <Card title={t.opCards.missingTitle} sub={t.opCards.missingSub} flat>
          {needing.length ? (
            <ul className="divide-y" style={{ borderColor: 'var(--line-soft)' }}>
              {needing.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <Link href={`/app/fleet/${v.sequenceNumber}`}>
                    <b>{v.plateNumber}</b> · {v.make} {v.model}
                  </Link>
                  <span className="flex items-center gap-2">
                    <span className="ui-num text-xs text-muted">{v.sequenceNumber}</span>
                    <Pill tone="red">{v.registrationType}</Pill>
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
          <StatusTabs base="/app/operating-cards" current={status} counts={counts} t={t} />
        </div>
        {bucket ? (
          <div className="px-5 pt-3">
            <ActiveFilter label={`${t.opCards.expiryDate}: ${t.expiry[bucket as 'd30']}`} clearHref={`/app/operating-cards?status=${status}`} />
          </div>
        ) : null}
        <CardsTable kind="operating_cards" rows={vm} today={today} canEdit={can(s.role, 'fleet:write') && (s.subscription?.canWrite ?? true)} />
      </Card>
    </>
  );
}

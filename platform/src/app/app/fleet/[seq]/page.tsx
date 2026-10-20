import { and, eq, inArray, or } from 'drizzle-orm';
import { Car, Contact, CreditCard, IdCard } from 'lucide-react';
import Link from 'next/link';
import { AlertList, sortAlerts } from '@/components/app/alert-list';
import { Card, Empty, Notice, PageHead, Pill } from '@/components/ui/card';
import { ExpiryBadge } from '@/components/ui/expiry';
import { db } from '@/db';
import { complianceAlerts, driverCards, operatingCards, residents, vehicles } from '@/db/schema';
import { vehicleReadiness } from '@/lib/analytics/fleet';
import { requireTenant } from '@/lib/auth/guards';
import { todayRiyadh } from '@/lib/dates';
import { getI18n } from '@/lib/i18n';
import { operatingCardRequirement } from '@/lib/rules/classify';

export default async function VehiclePage(props: PageProps<'/app/fleet/[seq]'>) {
  const s = await requireTenant();
  const { t, locale } = await getI18n();
  const { seq } = await props.params;
  const today = todayRiyadh();
  const tid = s.tenant.id;
  const [v] = await db.select().from(vehicles).where(and(eq(vehicles.tenantId, tid), eq(vehicles.sequenceNumber, seq)));
  if (!v) {
    return (
      <>
        <PageHead title={t.people.vehicleTitle} />
        <Notice tone="amber">{t.people.notFound}</Notice>
      </>
    );
  }
  const [cards, driver, dCards] = await Promise.all([
    db.select().from(operatingCards).where(and(eq(operatingCards.tenantId, tid), eq(operatingCards.sequenceNumber, seq))),
    v.actualUserId ? db.select().from(residents).where(and(eq(residents.tenantId, tid), eq(residents.iqamaNumber, v.actualUserId))) : Promise.resolve([]),
    v.actualUserId ? db.select().from(driverCards).where(and(eq(driverCards.tenantId, tid), eq(driverCards.driverId, v.actualUserId))) : Promise.resolve([]),
  ]);
  const holder = driver[0];
  const ids = [v.id, ...cards.map((c) => c.id)];
  const alerts = await db
    .select()
    .from(complianceAlerts)
    .where(and(eq(complianceAlerts.tenantId, tid), inArray(complianceAlerts.status, ['open', 'acknowledged', 'snoozed']), or(inArray(complianceAlerts.entityId, ids), eq(complianceAlerts.entityKey, seq))));
  const readiness = vehicleReadiness(v, cards, today, s.settings);
  const need = operatingCardRequirement(v, s.settings);
  const badge = (date: string | null) => <ExpiryBadge date={date} today={today} t={t} locale={locale} showDate />;
  return (
    <>
      <PageHead
        title={`${v.plateNumber ?? seq} · ${v.make ?? ''} ${v.model ?? ''}`}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <span className="ui-num">{seq}</span>
            <Pill tone={readiness.ready ? 'green' : 'red'}>{readiness.ready ? t.fleet.ready : t.fleet.notReady}</Pill>
            <Pill tone="gray">{v.registrationType}</Pill>
          </span>
        }
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={<span className="flex items-center gap-2"><Car size={18} />{t.people.vehicleTitle}</span>}>
          <dl className="dl">
            <dt>{t.fleet.licenseExpiry}</dt>
            <dd>{badge(v.licenseExpiry)} <span className="ui-num text-xs text-muted">{v.licenseExpiryHijri} هـ</span></dd>
            <dt>{t.fleet.inspectionExpiry}</dt>
            <dd>{badge(v.inspectionExpiry)} <span className="ui-num text-xs text-muted">{v.inspectionExpiryHijri} هـ</span></dd>
            <dt>{t.fleet.insurance}</dt>
            <dd><Pill tone={readiness.insurance ? 'green' : 'red'}>{v.insuranceStatus ?? '—'}</Pill></dd>
            <dt>{t.fleet.restriction}</dt>
            <dd><Pill tone={readiness.unrestricted ? 'green' : 'red'}>{v.restrictionStatus ?? '—'}</Pill></dd>
            <dt>{t.fleet.year}</dt>
            <dd className="ui-num">{v.manufactureYear ?? '—'}</dd>
            <dt>{t.fleet.chassis}</dt>
            <dd className="ui-num">{v.chassisNumber ?? '—'}</dd>
            <dt>{t.fleet.bodyType}</dt>
            <dd>{v.bodyType ?? '—'}</dd>
            <dt>{t.fleet.color}</dt>
            <dd>{v.color ?? '—'}</dd>
            <dt>{t.fleet.branch}</dt>
            <dd>{v.branch ?? '—'}</dd>
          </dl>
        </Card>
        <Card title={<span className="flex items-center gap-2"><CreditCard size={18} />{t.fleet.opCard}</span>} sub={t.fleet.opReasons[need.reason]} flat>
          {cards.length ? (
            <ul>
              {cards.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 first:border-t-0" style={{ borderColor: 'var(--line-soft)' }}>
                  <span>
                    <b className="ui-num">{c.cardNumber}</b> · {c.activity}
                  </span>
                  <span className="flex gap-2">
                    {badge(c.expiryDate)}
                    <Pill tone={c.cardStatus === 'نشط' ? 'green' : 'red'}>{c.cardStatus}</Pill>
                  </span>
                </li>
              ))}
            </ul>
          ) : need.required ? (
            <div className="p-5">
              <Notice tone="red">{t.opCards.missingSub}</Notice>
            </div>
          ) : (
            <Empty>{t.fleet.opCardNotRequired}</Empty>
          )}
        </Card>
        <Card title={<span className="flex items-center gap-2"><IdCard size={18} />{t.people.driver}</span>}>
          {v.actualUserId ? (
            <dl className="dl">
              <dt>{t.fleet.actualUser}</dt>
              <dd>
                <Link href={`/app/people/${v.actualUserId}`}>{holder?.name ?? v.actualUserName ?? v.actualUserId}</Link>
              </dd>
              <dt>{t.fleet.actualUserId}</dt>
              <dd className="ui-num">{v.actualUserId}</dd>
              {holder ? (
                <>
                  <dt>{t.people.driverPresence}</dt>
                  <dd>{holder.outsideKingdom ? <Pill tone="blue">{t.people.outsideKingdom}</Pill> : <Pill tone="green">{t.people.inKingdom}</Pill>}</dd>
                  <dt>{t.residents.iqamaExpiry}</dt>
                  <dd>{badge(holder.iqamaExpiry)}</dd>
                  <dt>{t.residents.occupation}</dt>
                  <dd>{holder.occupation ?? '—'}</dd>
                </>
              ) : null}
            </dl>
          ) : (
            <Notice tone="amber">{t.people.noDriver}</Notice>
          )}
        </Card>
        <Card title={<span className="flex items-center gap-2"><Contact size={18} />{t.people.driverCard}</span>} flat>
          {dCards.length ? (
            <ul>
              {dCards.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 first:border-t-0" style={{ borderColor: 'var(--line-soft)' }}>
                  <b className="ui-num">{c.cardNumber}</b>
                  {badge(c.expiryDate)}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{t.people.noDriverCard}</Empty>
          )}
        </Card>
      </div>
      <Card title={t.people.alerts} flat>
        <AlertList alerts={sortAlerts(alerts)} t={t} locale={locale} />
      </Card>
    </>
  );
}

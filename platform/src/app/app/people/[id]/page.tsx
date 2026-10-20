import { and, eq, inArray, or } from 'drizzle-orm';
import { Car, Contact, IdCard, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { AlertList, sortAlerts } from '@/components/app/alert-list';
import { Card, Empty, Money, Notice, PageHead, Pill } from '@/components/ui/card';
import { ExpiryBadge } from '@/components/ui/expiry';
import { db } from '@/db';
import { complianceAlerts, driverCards, gosiSubscribers, residents, vehicles } from '@/db/schema';
import { contributionFor, endOfServiceProvision, probationInfo } from '@/lib/analytics/gosi';
import { renewalConflict } from '@/lib/analytics/residents';
import { requireTenant } from '@/lib/auth/guards';
import { ageOn, todayRiyadh, toHijri } from '@/lib/dates';
import { fmtNumber, getI18n } from '@/lib/i18n';
import { isRegulatedDriverOccupation, sameOccupation } from '@/lib/rules/classify';
import { RULES } from '@/lib/rules/engine';

export default async function PersonPage(props: PageProps<'/app/people/[id]'>) {
  const s = await requireTenant();
  const { t, locale } = await getI18n();
  const { id } = await props.params;
  const today = todayRiyadh();
  const tid = s.tenant.id;
  const [[res], [gosi], cars, cards] = await Promise.all([
    db.select().from(residents).where(and(eq(residents.tenantId, tid), eq(residents.iqamaNumber, id))),
    db.select().from(gosiSubscribers).where(and(eq(gosiSubscribers.tenantId, tid), eq(gosiSubscribers.nationalId, id))),
    db.select().from(vehicles).where(and(eq(vehicles.tenantId, tid), eq(vehicles.actualUserId, id))),
    db.select().from(driverCards).where(and(eq(driverCards.tenantId, tid), eq(driverCards.driverId, id))),
  ]);
  if (!res && !gosi && !cars.length && !cards.length) {
    return (
      <>
        <PageHead title={t.people.title} />
        <Notice tone="amber">{t.people.notFound}</Notice>
      </>
    );
  }
  const entityIds = [res?.id, gosi?.id, ...cars.map((c) => c.id), ...cards.map((c) => c.id)].filter((x): x is string => !!x);
  const alerts = await db
    .select()
    .from(complianceAlerts)
    .where(and(eq(complianceAlerts.tenantId, tid), inArray(complianceAlerts.status, ['open', 'acknowledged', 'snoozed']), or(eq(complianceAlerts.entityKey, id), entityIds.length ? inArray(complianceAlerts.entityId, entityIds) : undefined)));
  const name = res?.name ?? gosi?.name ?? cards[0]?.firstName ?? id;
  const occupation = res?.occupation ?? gosi?.occupation ?? null;
  const needsCard = isRegulatedDriverOccupation(occupation, s.settings);
  const badge = (date: string | null) => <ExpiryBadge date={date} today={today} t={t} locale={locale} showDate />;

  return (
    <>
      <PageHead
        title={name}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <span className="ui-num">{id}</span>
            {occupation ? <Pill tone="gray">{occupation}</Pill> : null}
            {res?.outsideKingdom ? <Pill tone="blue">{t.residents.outside}</Pill> : null}
            {res && renewalConflict(res, today) ? <Pill tone="red">{t.residents.conflictBadge}</Pill> : null}
            {res && gosi && !sameOccupation(res.occupation, gosi.occupation) ? <Pill tone="amber">{locale === 'ar' ? RULES.X_OCCUPATION_MISMATCH.ar : RULES.X_OCCUPATION_MISMATCH.en}</Pill> : null}
          </span>
        }
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={<span className="flex items-center gap-2"><IdCard size={18} />{t.people.muqeem}</span>}>
          {res ? (
            <dl className="dl">
              <dt>{t.residents.nationality}</dt>
              <dd>{res.nationality ?? '—'}</dd>
              <dt>{t.residents.occupation}</dt>
              <dd>{res.occupation ?? '—'}</dd>
              <dt>{t.residents.iqamaExpiry}</dt>
              <dd>{badge(res.iqamaExpiry)}<span className="ms-2 text-xs text-muted ui-num">{res.iqamaExpiryHijri ?? toHijri(res.iqamaExpiry)} هـ</span></dd>
              <dt>{t.residents.passportNumber}</dt>
              <dd className="ui-num">{res.passportNumber ?? '—'}</dd>
              <dt>{t.residents.passportExpiry}</dt>
              <dd>{badge(res.passportExpiry)}</dd>
              <dt>{t.residents.birthDate}</dt>
              <dd>
                <span className="ui-num">{res.birthDate ?? '—'}</span> · {t.residents.age} <span className="ui-num">{ageOn(res.birthDate, today) ?? '—'}</span>
              </dd>
              <dt>{t.people.driverPresence}</dt>
              <dd>{res.outsideKingdom ? <Pill tone="blue">{t.people.outsideKingdom}</Pill> : <Pill tone="green">{t.people.inKingdom}</Pill>}</dd>
              <dt>{t.common.status}</dt>
              <dd>{res.recordStatus === 'active' ? t.common.active : res.recordStatus === 'missing' ? t.common.missing : t.common.archived}</dd>
            </dl>
          ) : (
            <Empty>{t.people.notInMuqeem}</Empty>
          )}
        </Card>
        <Card title={<span className="flex items-center gap-2"><ShieldCheck size={18} />{t.people.gosi}</span>}>
          {gosi ? (
            (() => {
              const c = contributionFor(gosi, s.settings);
              const eos = endOfServiceProvision(gosi, today, s.settings.eosWageBasis);
              const p = probationInfo(gosi, today, s.settings);
              return (
                <dl className="dl">
                  <dt>{t.gosi.basicWage}</dt>
                  <dd><Money value={gosi.basicWage} unit={t.common.sar} /></dd>
                  <dt>{t.gosi.housing}</dt>
                  <dd><Money value={gosi.housingAllowance} unit={t.common.sar} /></dd>
                  <dt>{t.gosi.totalWage}</dt>
                  <dd><Money value={gosi.totalWage} unit={t.common.sar} /></dd>
                  <dt>{t.gosi.contributoryWage}</dt>
                  <dd><Money value={gosi.contributoryWage} unit={t.common.sar} /></dd>
                  <dt>{t.gosi.contribution}</dt>
                  <dd>
                    {t.gosi.employerShare} <span className="ui-num">{fmtNumber(c.employer, 2)}</span> · {t.gosi.employeeShare} <span className="ui-num">{fmtNumber(c.employee, 2)}</span>
                  </dd>
                  <dt>{t.gosi.joinDate}</dt>
                  <dd className="ui-num">{gosi.joinDate ?? '—'}</dd>
                  <dt>{t.gosi.probation}</dt>
                  <dd>{p ? (p.reviewed ? t.gosi.probationReviewed : p.inProbation ? t.gosi.probationEnds.replace('{date}', p.endDate) : '—') : '—'}</dd>
                  <dt>{t.gosi.eos}</dt>
                  <dd>
                    <Money value={eos.amount} unit={t.common.sar} /> (<span className="ui-num">{fmtNumber(eos.years, 1)}</span> {t.gosi.serviceYears})
                  </dd>
                  <dt>{t.gosi.newSystem}</dt>
                  <dd>{gosi.newSystemEligible ? t.common.yes : t.common.no}</dd>
                </dl>
              );
            })()
          ) : (
            <Empty>{t.people.notInGosi}</Empty>
          )}
        </Card>
        <Card title={<span className="flex items-center gap-2"><Car size={18} />{t.people.vehicles}</span>} flat>
          {cars.length ? (
            <ul>
              {cars.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 first:border-t-0" style={{ borderColor: 'var(--line-soft)' }}>
                  <Link href={`/app/fleet/${v.sequenceNumber}`}>
                    <b>{v.plateNumber}</b> · {v.make} {v.model}
                  </Link>
                  <span className="flex flex-wrap gap-2">
                    {badge(v.licenseExpiry)}
                    {badge(v.inspectionExpiry)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{t.people.noVehicles}</Empty>
          )}
        </Card>
        <Card title={<span className="flex items-center gap-2"><Contact size={18} />{t.people.driverCard}</span>} flat>
          {cards.length ? (
            <ul>
              {cards.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 first:border-t-0" style={{ borderColor: 'var(--line-soft)' }}>
                  <span>
                    <b className="ui-num">{c.cardNumber}</b> · {c.activity}
                  </span>
                  <span className="flex gap-2">
                    {badge(c.expiryDate)}
                    <Pill tone={c.requestStatus === 'نشط' ? 'green' : 'red'}>{c.requestStatus}</Pill>
                  </span>
                </li>
              ))}
            </ul>
          ) : needsCard ? (
            <div className="p-5">
              <Notice tone="red">{t.people.driverCardNeeded}</Notice>
            </div>
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

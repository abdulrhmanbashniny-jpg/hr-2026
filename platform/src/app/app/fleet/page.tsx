import { eq } from 'drizzle-orm';
import { Car, CreditCard, Gauge, Hourglass, Upload, UserRound } from 'lucide-react';
import Link from 'next/link';
import { FleetTable, type VehicleVM } from '@/components/records/fleet-table';
import { ActiveFilter, StatusTabs } from '@/components/records/status-tabs';
import { BarList } from '@/components/ui/bar-list';
import { AddRecordButton } from '@/components/records/record-editor';
import { Card, PageHead } from '@/components/ui/card';
import { Kpi } from '@/components/ui/kpi';
import { ExpiryMatrix } from '@/components/ui/matrix';
import { db } from '@/db';
import { operatingCards, vehicles } from '@/db/schema';
import { fleetAnalytics, vehicleReadiness } from '@/lib/analytics/fleet';
import { requireTenant } from '@/lib/auth/guards';
import { can } from '@/lib/auth/rbac';
import { bucketFor, todayRiyadh } from '@/lib/dates';
import { f, fmtNumber, getI18n } from '@/lib/i18n';
import { operatingCardRequirement } from '@/lib/rules/classify';

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.fleet.title };
}

export default async function FleetPage(props: PageProps<'/app/fleet'>) {
  const s = await requireTenant();
  const { t, locale } = await getI18n();
  const sp = await props.searchParams;
  const status = (['active', 'missing', 'archived'].includes(String(sp.status)) ? sp.status : 'active') as 'active' | 'missing' | 'archived';
  const license = typeof sp.license === 'string' ? sp.license : null;
  const inspection = typeof sp.inspection === 'string' ? sp.inspection : null;
  const today = todayRiyadh();
  const [all, cards] = await Promise.all([
    db.select().from(vehicles).where(eq(vehicles.tenantId, s.tenant.id)),
    db.select().from(operatingCards).where(eq(operatingCards.tenantId, s.tenant.id)),
  ]);
  const stats = fleetAnalytics(all, cards, today, s.settings);
  const counts = { active: 0, missing: 0, archived: 0 };
  for (const v of all) counts[v.recordStatus]++;
  let rows = all.filter((v) => v.recordStatus === status);
  if (license) rows = rows.filter((v) => bucketFor(v.licenseExpiry, today) === license);
  if (inspection) rows = rows.filter((v) => bucketFor(v.inspectionExpiry, today) === inspection);
  const soonest = (v: (typeof rows)[number]) => [v.licenseExpiry, v.inspectionExpiry].filter(Boolean).sort()[0] ?? '9999';
  rows.sort((a, b) => soonest(a).localeCompare(soonest(b)));
  const vm: VehicleVM[] = rows.map((v) => {
    const r = vehicleReadiness(v, cards, today, s.settings);
    const need = operatingCardRequirement(v, s.settings);
    return {
      id: v.id,
      sequenceNumber: v.sequenceNumber,
      plateNumber: v.plateNumber,
      make: v.make,
      model: v.model,
      year: v.manufactureYear,
      registrationType: v.registrationType,
      branch: v.branch,
      licenseExpiry: v.licenseExpiry,
      licenseExpiryHijri: v.licenseExpiryHijri,
      inspectionExpiry: v.inspectionExpiry,
      inspectionExpiryHijri: v.inspectionExpiryHijri,
      actualUserId: v.actualUserId,
      actualUserName: v.actualUserName,
      insuranceStatus: v.insuranceStatus,
      restrictionStatus: v.restrictionStatus,
      readiness: r,
      opRequired: need.required,
      opReason: need.reason,
      opRequirement: v.operatingCardRequirement,
      recordStatus: v.recordStatus,
    };
  });
  const i = { size: 16 };
  const other = locale === 'ar' ? 'أخرى' : 'Other';
  const failing = [
    { name: t.fleet.failLicense, count: stats.failing.license },
    { name: t.fleet.failInspection, count: stats.failing.inspection },
    { name: t.fleet.failInsurance, count: stats.failing.insurance },
    { name: t.fleet.failRestricted, count: stats.failing.restricted },
    { name: t.fleet.failOpCard, count: stats.failing.operatingCard },
  ];
  return (
    <>
      <PageHead
        title={t.fleet.title}
        sub={t.fleet.subtitle}
        actions={
          <>
            <AddRecordButton kind="vehicles" canEdit={can(s.role, 'fleet:write') && (s.subscription?.canWrite ?? true)} />
            <Link href="/app/imports#vehicles" className="ui-btn ui-btn--primary">
              <Upload size={18} />
              {t.nav.imports}
            </Link>
          </>
        }
      />
      <div className="kpi-grid">
        <Kpi icon={<Car {...i} />} label={t.fleet.kpiTotal} value={fmtNumber(stats.total)} foot={f(t.dashboard.kpiFleetFoot, { ready: stats.ready, total: stats.total })} />
        <Kpi icon={<Gauge {...i} />} label={t.fleet.kpiReadiness} value={`${fmtNumber(stats.readinessPct, 1)}%`} foot={t.fleet.kpiReadinessFoot} tone={stats.readinessPct < 80 ? 'down' : 'up'} />
        <Kpi icon={<UserRound {...i} />} label={t.fleet.kpiNoUser} value={fmtNumber(stats.noUser)} foot={`${stats.overloadedUsers} · ${t.fleet.filterNoUser}`} />
        <Kpi icon={<CreditCard {...i} />} label={t.fleet.kpiOpMissing} value={fmtNumber(stats.opCardMissing)} foot={f(t.fleet.kpiOpMissingFoot, { n: stats.opCardRequired })} tone={stats.opCardMissing ? 'down' : undefined} />
        <Kpi icon={<Hourglass {...i} />} label={t.fleet.kpiAge} value={stats.averageAge ?? '—'} foot={t.fleet.kpiAgeFoot} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ExpiryMatrix title={t.fleet.licenseMatrix} matrix={stats.licenseMatrix} t={t} hrefFor={(b) => `/app/fleet?license=${b}`} active={license} />
        <ExpiryMatrix title={t.fleet.inspectionMatrix} matrix={stats.inspectionMatrix} t={t} hrefFor={(b) => `/app/fleet?inspection=${b}`} active={inspection} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t.fleet.failing}>
          <BarList items={failing} otherLabel={other} single />
        </Card>
        <Card title={t.fleet.byAge}>
          <BarList items={stats.byAge.map((x) => ({ ...x, name: `${x.name} ${t.fleet.years}` }))} otherLabel={other} />
        </Card>
        <Card title={t.fleet.byRegistration}>
          <BarList items={stats.byRegistrationType} otherLabel={other} />
        </Card>
      </div>
      <Card flat>
        <div className="px-5 pt-3">
          <StatusTabs base="/app/fleet" current={status} counts={counts} t={t} />
        </div>
        {license || inspection ? (
          <div className="px-5 pt-3">
            <ActiveFilter label={`${license ? t.fleet.licenseExpiry : t.fleet.inspectionExpiry}: ${t.expiry[(license ?? inspection) as 'd30']}`} clearHref={`/app/fleet?status=${status}`} />
          </div>
        ) : null}
        <FleetTable rows={vm} today={today} canEdit={can(s.role, 'fleet:write') && (s.subscription?.canWrite ?? true)} />
      </Card>
    </>
  );
}

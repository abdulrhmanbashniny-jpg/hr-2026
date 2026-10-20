import { and, eq } from 'drizzle-orm';
import { CalendarClock, IdCard, Plane, TriangleAlert, Upload } from 'lucide-react';
import Link from 'next/link';
import { ResidentsTable, type ResidentVM } from '@/components/records/residents-table';
import { ActiveFilter, StatusTabs } from '@/components/records/status-tabs';
import { BarList } from '@/components/ui/bar-list';
import { AddRecordButton } from '@/components/records/record-editor';
import { Card, PageHead } from '@/components/ui/card';
import { Kpi } from '@/components/ui/kpi';
import { ExpiryMatrix } from '@/components/ui/matrix';
import { db } from '@/db';
import { residents } from '@/db/schema';
import { renewalConflict, residentAnalytics } from '@/lib/analytics/residents';
import { requireTenant } from '@/lib/auth/guards';
import { can } from '@/lib/auth/rbac';
import { ageOn, bucketFor, todayRiyadh } from '@/lib/dates';
import { f, fmtNumber, getI18n } from '@/lib/i18n';

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.residents.title };
}

export default async function ResidentsPage(props: PageProps<'/app/residents'>) {
  const s = await requireTenant();
  const { t, locale } = await getI18n();
  const sp = await props.searchParams;
  const status = (['active', 'missing', 'archived'].includes(String(sp.status)) ? sp.status : 'active') as 'active' | 'missing' | 'archived';
  const bucket = typeof sp.bucket === 'string' ? sp.bucket : null;
  const passport = typeof sp.passport === 'string' ? sp.passport : null;
  const today = todayRiyadh();
  const all = await db.select().from(residents).where(eq(residents.tenantId, s.tenant.id));
  const stats = residentAnalytics(all, today, s.settings);
  const counts = { active: 0, missing: 0, archived: 0 };
  for (const r of all) counts[r.recordStatus]++;

  let rows = all.filter((r) => r.recordStatus === status);
  if (bucket) rows = rows.filter((r) => bucketFor(r.iqamaExpiry, today) === bucket);
  if (passport) rows = rows.filter((r) => bucketFor(r.passportExpiry, today) === passport);
  rows.sort((a, b) => (a.iqamaExpiry ?? '9999').localeCompare(b.iqamaExpiry ?? '9999'));
  const vm: ResidentVM[] = rows.map((r) => ({
    id: r.id,
    iqamaNumber: r.iqamaNumber,
    name: r.name,
    nationality: r.nationality,
    occupation: r.occupation,
    passportNumber: r.passportNumber,
    passportExpiry: r.passportExpiry,
    iqamaExpiry: r.iqamaExpiry,
    age: ageOn(r.birthDate, today),
    outsideKingdom: r.outsideKingdom,
    conflict: renewalConflict(r, today),
    recordStatus: r.recordStatus,
    archiveReason: r.archiveReason,
  }));
  const i = { size: 16 };
  const other = locale === 'ar' ? 'أخرى' : 'Other';

  return (
    <>
      <PageHead
        title={t.residents.title}
        sub={t.residents.subtitle}
        actions={
          <>
            <AddRecordButton kind="residents" canEdit={can(s.role, 'people:write') && (s.subscription?.canWrite ?? true)} />
            <Link href="/app/imports#residents" className="ui-btn ui-btn--primary">
              <Upload size={18} />
              {t.nav.imports}
            </Link>
          </>
        }
      />
      <div className="kpi-grid">
        <Kpi icon={<IdCard {...i} />} label={t.residents.kpiTotal} value={fmtNumber(stats.total)} foot={f(t.dashboard.kpiResidentsFoot, { n: stats.byNationality.length, abroad: stats.outsideKingdom })} />
        <Kpi icon={<Plane {...i} />} label={t.residents.kpiOutside} value={fmtNumber(stats.outsideKingdom)} foot={f(t.residents.kpiOutsideFoot, { n: stats.outsideKingdomAtRisk })} tone={stats.outsideKingdomAtRisk ? 'down' : undefined} />
        <Kpi icon={<TriangleAlert {...i} />} label={t.residents.kpiConflicts} value={fmtNumber(stats.renewalConflicts)} foot={t.residents.kpiConflictsFoot} tone={stats.renewalConflicts ? 'down' : undefined} />
        <Kpi icon={<CalendarClock {...i} />} label={t.residents.kpiSeniors} value={fmtNumber(stats.seniors)} foot={t.residents.kpiSeniorsFoot} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ExpiryMatrix title={t.residents.iqamaMatrix} matrix={stats.iqamaMatrix} t={t} hrefFor={(b) => `/app/residents?bucket=${b}`} active={bucket} />
        <ExpiryMatrix title={t.residents.passportMatrix} matrix={stats.passportMatrix} t={t} hrefFor={(b) => `/app/residents?passport=${b}`} active={passport} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t.residents.byNationality}>
          <BarList items={stats.byNationality} otherLabel={other} />
        </Card>
        <Card title={t.residents.byOccupation}>
          <BarList items={stats.byOccupation} otherLabel={other} max={8} single />
        </Card>
      </div>
      <Card flat>
        <div className="px-5 pt-3">
          <StatusTabs base="/app/residents" current={status} counts={counts} t={t} />
        </div>
        {bucket || passport ? (
          <div className="px-5 pt-3">
            <ActiveFilter label={`${bucket ? t.residents.iqamaExpiry : t.residents.passportExpiry}: ${t.expiry[(bucket ?? passport) as 'd30']}`} clearHref={`/app/residents?status=${status}`} />
          </div>
        ) : null}
        <ResidentsTable rows={vm} today={today} canEdit={can(s.role, 'people:write') && (s.subscription?.canWrite ?? true)} />
      </Card>
    </>
  );
}

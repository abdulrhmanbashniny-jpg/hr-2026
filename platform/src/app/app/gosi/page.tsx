import { eq } from 'drizzle-orm';
import { Banknote, Hourglass, Landmark, ShieldCheck, TriangleAlert, Upload, Users } from 'lucide-react';
import Link from 'next/link';
import { GosiTable, type GosiVM } from '@/components/records/gosi-table';
import { StatusTabs } from '@/components/records/status-tabs';
import { BarList } from '@/components/ui/bar-list';
import { Card, PageHead } from '@/components/ui/card';
import { Kpi } from '@/components/ui/kpi';
import { db } from '@/db';
import { gosiSubscribers } from '@/db/schema';
import { contributionFor, endOfServiceProvision, gosiAnalytics, probationInfo } from '@/lib/analytics/gosi';
import { requireTenant } from '@/lib/auth/guards';
import { can } from '@/lib/auth/rbac';
import { todayRiyadh } from '@/lib/dates';
import { f, fmtMoney, fmtNumber, getI18n } from '@/lib/i18n';

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.gosi.title };
}

export default async function GosiPage(props: PageProps<'/app/gosi'>) {
  const s = await requireTenant();
  const { t, locale } = await getI18n();
  const sp = await props.searchParams;
  const status = (['active', 'missing', 'archived'].includes(String(sp.status)) ? sp.status : 'active') as 'active' | 'missing' | 'archived';
  const today = todayRiyadh();
  const all = await db.select().from(gosiSubscribers).where(eq(gosiSubscribers.tenantId, s.tenant.id));
  const stats = gosiAnalytics(all, today, s.settings);
  const counts = { active: 0, missing: 0, archived: 0 };
  for (const r of all) counts[r.recordStatus]++;
  const vm: GosiVM[] = all
    .filter((r) => r.recordStatus === status)
    .map((r) => {
      const c = contributionFor(r, s.settings);
      const eos = endOfServiceProvision(r, today, s.settings.eosWageBasis);
      const p = probationInfo(r, today, s.settings);
      return {
        id: r.id,
        nationalId: r.nationalId,
        name: r.name,
        nationality: r.nationality,
        isSaudi: r.isSaudi,
        occupation: r.occupation,
        basicWage: r.basicWage,
        housingAllowance: r.housingAllowance,
        totalWage: r.totalWage,
        contributoryWage: r.contributoryWage,
        joinDate: r.joinDate,
        newSystemEligible: r.newSystemEligible,
        employerShare: c.employer,
        employeeShare: c.employee,
        eosYears: eos.years,
        eosAmount: eos.amount,
        probationEnd: p?.endDate ?? null,
        probationLeft: p && p.inProbation ? p.left : null,
        probationReviewed: !!r.probationReviewedAt,
        probationDays: r.probationDays,
        lowWage: r.isSaudi && r.contributoryWage < s.settings.saudiMinContributoryWage,
        recordStatus: r.recordStatus,
      };
    });
  const i = { size: 16 };
  return (
    <>
      <PageHead
        title={t.gosi.title}
        sub={t.gosi.subtitle}
        actions={
          <Link href="/app/imports#gosi" className="ui-btn ui-btn--primary">
            <Upload size={18} />
            {t.nav.imports}
          </Link>
        }
      />
      <div className="kpi-grid">
        <Kpi icon={<Users {...i} />} label={t.gosi.kpiTotal} value={fmtNumber(stats.total)} foot={f(t.gosi.kpiSaudizationFoot, { saudis: stats.saudis, non: stats.nonSaudis })} />
        <Kpi icon={<ShieldCheck {...i} />} label={t.gosi.kpiSaudization} value={`${fmtNumber(stats.saudizationPct, 1)}%`} foot={f(t.dashboard.kpiSaudizationFoot, { saudis: stats.saudis, total: stats.total })} />
        <Kpi icon={<TriangleAlert {...i} />} label={t.gosi.kpiLowWage} value={fmtNumber(stats.lowWageSaudis)} foot={t.gosi.kpiLowWageFoot} tone={stats.lowWageSaudis ? 'down' : undefined} />
        <Kpi icon={<Landmark {...i} />} label={t.gosi.kpiBill} value={fmtNumber(stats.monthlyContribution.total)} foot={f(t.gosi.kpiBillFoot, { employer: fmtMoney(stats.monthlyContribution.employer, locale), employee: fmtMoney(stats.monthlyContribution.employee, locale) })} />
        <Kpi icon={<Banknote {...i} />} label={t.gosi.kpiPayroll} value={fmtNumber(stats.payroll.totalWage)} foot={f(t.gosi.kpiPayrollFoot, { gap: fmtMoney(stats.payroll.gap, locale) })} />
        <Kpi icon={<Banknote {...i} />} label={t.gosi.kpiEos} value={fmtNumber(stats.eosTotal)} foot={`${t.common.sar} · ${t.gosi.kpiEosFoot}`} />
        <Kpi icon={<Hourglass {...i} />} label={t.gosi.kpiProbation} value={fmtNumber(stats.inProbation)} foot={f(t.gosi.kpiProbationFoot, { n: stats.probationEndingSoon })} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t.gosi.avgWage}>
          <BarList items={stats.avgWageByNationality.map((x) => ({ name: `${x.name} (${x.count})`, count: x.avgWage }))} otherLabel={locale === 'ar' ? 'أخرى' : 'Other'} format={(n) => fmtMoney(n, locale)} max={8} single />
        </Card>
        <Card title={t.residents.byNationality}>
          <BarList items={stats.byNationality} otherLabel={locale === 'ar' ? 'أخرى' : 'Other'} />
        </Card>
      </div>
      <Card flat>
        <div className="px-5 pt-3">
          <StatusTabs base="/app/gosi" current={status} counts={counts} t={t} />
        </div>
        <GosiTable rows={vm} canEdit={can(s.role, 'people:write') && (s.subscription?.canWrite ?? true)} />
      </Card>
    </>
  );
}

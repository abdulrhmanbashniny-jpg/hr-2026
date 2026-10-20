import { addDays, daysBetween, daysUntil } from '@/lib/dates';
import type { GosiRow } from '@/lib/rules/engine';
import type { TenantSettings } from '@/lib/settings';
import { countBy } from './common';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Monthly GOSI contribution for one subscriber, split by payer. */
export function contributionFor(row: Pick<GosiRow, 'isSaudi' | 'newSystemEligible' | 'contributoryWage'>, settings: TenantSettings) {
  const wage = Math.min(row.contributoryWage, settings.gosi.maxContributoryWage);
  if (!row.isSaudi) return { employer: round2((wage * settings.gosi.nonSaudiEmployerPct) / 100), employee: 0, wage };
  const employerPct = row.newSystemEligible ? settings.gosi.saudiNewEmployerPct : settings.gosi.saudiEmployerPct;
  const employeePct = row.newSystemEligible ? settings.gosi.saudiNewEmployeePct : settings.gosi.saudiEmployeePct;
  return { employer: round2((wage * employerPct) / 100), employee: round2((wage * employeePct) / 100), wage };
}

/**
 * End-of-service award under Article 84 of the Saudi Labour Law: half a month's wage for each of the
 * first five years and a full month for every year after, pro-rated for part years. This is the
 * full accrued entitlement (the provision), before any resignation reduction under Article 85.
 */
export function endOfServiceProvision(
  row: Pick<GosiRow, 'joinDate' | 'basicWage' | 'housingAllowance' | 'totalWage'>,
  today: string,
  basis: TenantSettings['eosWageBasis'],
) {
  if (!row.joinDate) return { years: 0, monthlyWage: 0, amount: 0 };
  const years = Math.max(0, daysBetween(row.joinDate, today) / 365.25);
  const monthlyWage = basis === 'total' ? row.totalWage : row.basicWage + row.housingAllowance;
  const firstFive = Math.min(years, 5) * 0.5;
  const afterFive = Math.max(years - 5, 0) * 1;
  return { years: round2(years), monthlyWage, amount: round2((firstFive + afterFive) * monthlyWage) };
}

export function probationInfo(row: Pick<GosiRow, 'joinDate' | 'probationDays' | 'probationReviewedAt'>, today: string, settings: TenantSettings) {
  if (!row.joinDate) return null;
  const days = row.probationDays ?? settings.probationDays;
  const endDate = addDays(row.joinDate, days);
  const left = daysUntil(endDate, today)!;
  return { days, endDate, left, inProbation: left >= 0, reviewed: !!row.probationReviewedAt };
}

export function gosiAnalytics(rows: GosiRow[], today: string, settings: TenantSettings) {
  const active = rows.filter((r) => r.recordStatus === 'active');
  const saudis = active.filter((r) => r.isSaudi);
  const contributions = active.map((r) => contributionFor(r, settings));
  const employer = round2(contributions.reduce((s, c) => s + c.employer, 0));
  const employee = round2(contributions.reduce((s, c) => s + c.employee, 0));
  const totalWage = round2(active.reduce((s, r) => s + r.totalWage, 0));
  const contributory = round2(active.reduce((s, r) => s + r.contributoryWage, 0));
  const eos = active.map((r) => endOfServiceProvision(r, today, settings.eosWageBasis));
  const probation = active
    .map((r) => ({ row: r, info: probationInfo(r, today, settings) }))
    .filter((x) => x.info && x.info.inProbation && !x.info.reviewed);
  const nationalityWage = new Map<string, { count: number; wage: number }>();
  for (const r of active) {
    const k = r.nationality?.trim() || '—';
    const cur = nationalityWage.get(k) ?? { count: 0, wage: 0 };
    nationalityWage.set(k, { count: cur.count + 1, wage: cur.wage + r.totalWage });
  }
  return {
    total: active.length,
    missing: rows.filter((r) => r.recordStatus === 'missing').length,
    saudis: saudis.length,
    nonSaudis: active.length - saudis.length,
    saudizationPct: active.length ? round2((saudis.length / active.length) * 100) : 0,
    lowWageSaudis: saudis.filter((r) => r.contributoryWage < settings.saudiMinContributoryWage).length,
    newSystemCount: saudis.filter((r) => r.newSystemEligible).length,
    payroll: { totalWage, contributory, gap: round2(totalWage - contributory) },
    monthlyContribution: { employer, employee, total: round2(employer + employee) },
    byNationality: countBy(active, (r) => r.nationality),
    avgWageByNationality: [...nationalityWage]
      .map(([name, v]) => ({ name, count: v.count, avgWage: round2(v.wage / v.count) }))
      .sort((a, b) => b.count - a.count),
    eosTotal: round2(eos.reduce((s, e) => s + e.amount, 0)),
    inProbation: probation.length,
    probationEndingSoon: probation.filter((x) => x.info!.left <= settings.probationAlertLeadDays).length,
  };
}

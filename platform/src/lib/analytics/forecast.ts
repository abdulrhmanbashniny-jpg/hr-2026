import { addDays, daysUntil } from '@/lib/dates';
import { isActiveCardStatus, isRegulatedDriverOccupation, operatingCardRequirement } from '@/lib/rules/classify';
import type { RulesInput } from '@/lib/rules/engine';
import { contributionFor } from './gosi';

export type FeeCategory = 'iqama' | 'operating_card' | 'driver_card' | 'inspection' | 'vehicle_license' | 'document' | 'gosi';
export const FEE_CATEGORIES: FeeCategory[] = ['iqama', 'gosi', 'operating_card', 'driver_card', 'inspection', 'vehicle_license', 'document'];

/** The government platform each fee is paid through. */
export type PlatformKey = 'muqeem' | 'gosi' | 'tamm' | 'operating_cards' | 'driver_cards' | 'documents';
export const PLATFORMS: PlatformKey[] = ['muqeem', 'gosi', 'tamm', 'operating_cards', 'driver_cards', 'documents'];
const PLATFORM_OF: Record<FeeCategory, PlatformKey> = {
  iqama: 'muqeem',
  gosi: 'gosi',
  inspection: 'tamm',
  vehicle_license: 'tamm',
  operating_card: 'operating_cards',
  driver_card: 'driver_cards',
  document: 'documents',
};

export type FeePart = 'iqamaFee' | 'workPermit' | 'employer' | 'employee' | 'inspection' | 'license' | 'renewal' | 'newIssue' | 'document';

export interface FeeLine {
  category: FeeCategory;
  platform: PlatformKey;
  /** renewal of something that expires, a first issuance that is missing, or a recurring bill. */
  kind: 'renewal' | 'new' | 'bill';
  key: string;
  label: string;
  dueDate: string | null;
  daysLeft: number | null;
  amount: number;
  parts: { part: FeePart; amount: number }[];
  link: string;
}

export interface HorizonSummary {
  days: number;
  total: number;
  byCategory: Record<FeeCategory, { count: number; amount: number }>;
  byPlatform: Record<PlatformKey, { count: number; amount: number; overdue: number; parts: Partial<Record<FeePart, number>> }>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The next GOSI bill due dates (the 15th of each month) on or after today, up to `days` ahead. */
function gosiDueDates(today: string, days: number): string[] {
  const [y, m, d] = today.split('-').map(Number);
  const out: string[] = [];
  for (let i = d <= 15 ? 0 : 1; out.length < 6; i++) {
    const due = new Date(Date.UTC(y, m - 1 + i, 15)).toISOString().slice(0, 10);
    if ((daysUntil(due, today) ?? 0) > days) break;
    out.push(due);
  }
  return out;
}

/**
 * Projects government payments due within the next 30/60/90 days from real expiry dates and the
 * company's average fee per transaction, grouped by the platform they are paid through. Items already
 * expired are due now and fall in every horizon. Missing first issuances (a heavy-truck driver with no
 * driver card, a vehicle that needs an operating card and has none) are due now. GOSI is one bill per
 * month, due on the 15th.
 */
export function feesForecast(input: RulesInput, horizons: number[] = [30, 60, 90]) {
  const { today, settings } = input;
  const max = Math.max(...horizons);
  const lines: FeeLine[] = [];
  const add = (line: Omit<FeeLine, 'platform' | 'daysLeft'> & { daysLeft?: number | null }) => {
    const left = line.daysLeft !== undefined ? line.daysLeft : daysUntil(line.dueDate, today);
    if (left === null || left > max || line.amount <= 0) return;
    lines.push({ ...line, platform: PLATFORM_OF[line.category], daysLeft: left });
  };
  const fees = settings.fees;

  for (const r of input.residents) {
    if (r.recordStatus !== 'active') continue;
    add({
      category: 'iqama',
      kind: 'renewal',
      key: r.iqamaNumber,
      label: r.name,
      dueDate: r.iqamaExpiry,
      amount: fees.iqamaRenewal + fees.workPermit,
      parts: [
        { part: 'iqamaFee', amount: fees.iqamaRenewal },
        { part: 'workPermit', amount: fees.workPermit },
      ],
      link: `/app/people/${r.iqamaNumber}`,
    });
  }

  for (const v of input.vehicles) {
    if (v.recordStatus !== 'active') continue;
    const label = [v.plateNumber, v.make, v.model].filter(Boolean).join(' · ') || v.sequenceNumber;
    const link = `/app/fleet/${v.sequenceNumber}`;
    add({ category: 'inspection', kind: 'renewal', key: `i:${v.sequenceNumber}`, label, dueDate: v.inspectionExpiry, amount: fees.inspection, parts: [{ part: 'inspection', amount: fees.inspection }], link });
    add({ category: 'vehicle_license', kind: 'renewal', key: `l:${v.sequenceNumber}`, label, dueDate: v.licenseExpiry, amount: fees.vehicleLicense, parts: [{ part: 'license', amount: fees.vehicleLicense }], link });
  }

  const required = input.vehicles.filter((v) => v.recordStatus === 'active' && operatingCardRequirement(v, settings).required);
  const requiredSeq = new Set(required.map((v) => v.sequenceNumber));
  const carded = new Set<string>();
  for (const c of input.operatingCards) {
    if (c.recordStatus !== 'active') continue;
    if (c.sequenceNumber && isActiveCardStatus(c.cardStatus)) carded.add(c.sequenceNumber);
    if (c.sequenceNumber && input.vehicles.length && !requiredSeq.has(c.sequenceNumber)) continue;
    add({ category: 'operating_card', kind: 'renewal', key: c.cardNumber, label: c.cardNumber, dueDate: c.expiryDate, amount: fees.operatingCard, parts: [{ part: 'renewal', amount: fees.operatingCard }], link: '/app/operating-cards' });
  }
  for (const v of required) {
    if (carded.has(v.sequenceNumber)) continue;
    const label = [v.plateNumber, v.make, v.model].filter(Boolean).join(' · ') || v.sequenceNumber;
    add({ category: 'operating_card', kind: 'new', key: `new:${v.sequenceNumber}`, label, dueDate: null, daysLeft: 0, amount: fees.operatingCard, parts: [{ part: 'newIssue', amount: fees.operatingCard }], link: `/app/fleet/${v.sequenceNumber}` });
  }

  const cardHolders = new Set<string>();
  for (const c of input.driverCards) {
    if (c.recordStatus !== 'active') continue;
    cardHolders.add(c.driverId);
    const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.driverId;
    add({ category: 'driver_card', kind: 'renewal', key: c.cardNumber, label: name, dueDate: c.expiryDate, amount: fees.driverCard, parts: [{ part: 'renewal', amount: fees.driverCard }], link: `/app/people/${c.driverId}` });
  }
  let pendingDrivers = 0;
  for (const r of input.residents) {
    if (r.recordStatus !== 'active' || !isRegulatedDriverOccupation(r.occupation, settings) || cardHolders.has(r.iqamaNumber)) continue;
    pendingDrivers++;
    add({ category: 'driver_card', kind: 'new', key: `new:${r.iqamaNumber}`, label: r.name, dueDate: null, daysLeft: 0, amount: fees.driverCard, parts: [{ part: 'newIssue', amount: fees.driverCard }], link: `/app/people/${r.iqamaNumber}` });
  }

  for (const d of input.documents) {
    if (d.status === 'archived' || !d.renewalFee) continue;
    add({ category: 'document', kind: 'renewal', key: d.id, label: d.title, dueDate: d.expiryDate, amount: d.renewalFee, parts: [{ part: 'document', amount: d.renewalFee }], link: `/app/documents?doc=${d.id}` });
  }

  const gosiActive = input.gosi.filter((g) => g.recordStatus === 'active');
  const gosiEmployees = gosiActive
    .map((g) => {
      const c = contributionFor(g, settings);
      return { nationalId: g.nationalId, name: g.name, isSaudi: g.isSaudi, wage: c.wage, employer: c.employer, employee: c.employee, total: round2(c.employer + c.employee) };
    })
    .sort((a, b) => b.total - a.total);
  const gosiEmployerMonthly = round2(gosiEmployees.reduce((s, g) => s + g.employer, 0));
  const gosiEmployeeMonthly = round2(gosiEmployees.reduce((s, g) => s + g.employee, 0));
  const gosiMonthly = round2(gosiEmployerMonthly + gosiEmployeeMonthly);
  if (gosiMonthly > 0) {
    for (const due of gosiDueDates(today, max)) {
      add({
        category: 'gosi',
        kind: 'bill',
        key: `gosi:${due}`,
        label: due.slice(0, 7),
        dueDate: due,
        amount: gosiMonthly,
        parts: [
          { part: 'employer', amount: gosiEmployerMonthly },
          { part: 'employee', amount: gosiEmployeeMonthly },
        ],
        link: '/app/gosi',
      });
    }
  }

  const summaries: HorizonSummary[] = horizons.map((days) => {
    const byCategory = Object.fromEntries(FEE_CATEGORIES.map((c) => [c, { count: 0, amount: 0 }])) as HorizonSummary['byCategory'];
    const byPlatform = Object.fromEntries(PLATFORMS.map((p) => [p, { count: 0, amount: 0, overdue: 0, parts: {} }])) as HorizonSummary['byPlatform'];
    for (const l of lines) {
      if ((l.daysLeft ?? Infinity) > days) continue;
      byCategory[l.category].count++;
      byCategory[l.category].amount += l.amount;
      const p = byPlatform[l.platform];
      p.count++;
      p.amount += l.amount;
      if ((l.daysLeft ?? 0) < 0) p.overdue++;
      for (const part of l.parts) p.parts[part.part] = round2((p.parts[part.part] ?? 0) + part.amount);
    }
    for (const c of FEE_CATEGORIES) byCategory[c].amount = round2(byCategory[c].amount);
    for (const p of PLATFORMS) byPlatform[p].amount = round2(byPlatform[p].amount);
    const total = round2(Object.values(byPlatform).reduce((s, c) => s + c.amount, 0));
    return { days, total, byCategory, byPlatform };
  });

  return {
    lines: lines.sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0)),
    summaries,
    gosiMonthly,
    gosiEmployerMonthly,
    gosiEmployeeMonthly,
    gosiEmployees,
    pendingNewDriverCards: { count: pendingDrivers, amount: pendingDrivers * fees.driverCard },
    nextGosiDue: gosiDueDates(today, 45)[0] ?? addDays(today, 30),
  };
}

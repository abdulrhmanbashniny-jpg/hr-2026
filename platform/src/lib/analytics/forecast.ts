import { daysUntil } from '@/lib/dates';
import { isRegulatedDriverOccupation, operatingCardRequirement } from '@/lib/rules/classify';
import type { RulesInput } from '@/lib/rules/engine';
import { contributionFor } from './gosi';

export type FeeCategory = 'iqama' | 'operating_card' | 'driver_card' | 'inspection' | 'vehicle_license' | 'document' | 'gosi';
export const FEE_CATEGORIES: FeeCategory[] = ['iqama', 'gosi', 'operating_card', 'driver_card', 'inspection', 'vehicle_license', 'document'];

export interface FeeLine {
  category: FeeCategory;
  key: string;
  label: string;
  dueDate: string | null;
  daysLeft: number | null;
  amount: number;
  link: string;
}

export interface HorizonSummary {
  days: number;
  total: number;
  byCategory: Record<FeeCategory, { count: number; amount: number }>;
}

const emptyByCategory = (): HorizonSummary['byCategory'] =>
  Object.fromEntries(FEE_CATEGORIES.map((c) => [c, { count: 0, amount: 0 }])) as HorizonSummary['byCategory'];

/**
 * Projects government payments due within the next 30/60/90 days from real expiry dates, using the
 * company's average fee per transaction. Items already expired are due now and fall in every horizon.
 * The GOSI bill is recurring, counted once per month inside the horizon.
 */
export function feesForecast(input: RulesInput, horizons: number[] = [30, 60, 90]) {
  const { today, settings } = input;
  const max = Math.max(...horizons);
  const lines: FeeLine[] = [];
  const add = (category: FeeCategory, key: string, label: string, dueDate: string | null, amount: number, link: string) => {
    const left = daysUntil(dueDate, today);
    if (left === null || left > max || amount <= 0) return;
    lines.push({ category, key, label, dueDate, daysLeft: left, amount, link });
  };

  const iqamaFee = settings.fees.iqamaRenewal + settings.fees.workPermit;
  for (const r of input.residents) {
    if (r.recordStatus !== 'active') continue;
    add('iqama', r.iqamaNumber, r.name, r.iqamaExpiry, iqamaFee, `/app/people/${r.iqamaNumber}`);
  }
  for (const v of input.vehicles) {
    if (v.recordStatus !== 'active') continue;
    const label = [v.plateNumber, v.make].filter(Boolean).join(' · ') || v.sequenceNumber;
    add('inspection', v.sequenceNumber, label, v.inspectionExpiry, settings.fees.inspection, `/app/fleet/${v.sequenceNumber}`);
    add('vehicle_license', v.sequenceNumber, label, v.licenseExpiry, settings.fees.vehicleLicense, `/app/fleet/${v.sequenceNumber}`);
  }
  const requiredSeq = new Set(input.vehicles.filter((v) => v.recordStatus === 'active' && operatingCardRequirement(v, settings).required).map((v) => v.sequenceNumber));
  for (const c of input.operatingCards) {
    if (c.recordStatus !== 'active') continue;
    if (c.sequenceNumber && input.vehicles.length && !requiredSeq.has(c.sequenceNumber)) continue;
    add('operating_card', c.cardNumber, c.cardNumber, c.expiryDate, settings.fees.operatingCard, '/app/operating-cards');
  }
  for (const c of input.driverCards) {
    if (c.recordStatus !== 'active') continue;
    const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.driverId;
    add('driver_card', c.cardNumber, name, c.expiryDate, settings.fees.driverCard, `/app/people/${c.driverId}`);
  }
  for (const d of input.documents) {
    if (d.status === 'archived' || !d.renewalFee) continue;
    add('document', d.id, d.title, d.expiryDate, d.renewalFee, `/app/documents?doc=${d.id}`);
  }

  const gosiActive = input.gosi.filter((g) => g.recordStatus === 'active');
  const gosiMonthly = Math.round(
    gosiActive.reduce((s, g) => {
      const c = contributionFor(g, settings);
      return s + c.employer + c.employee;
    }, 0) * 100,
  ) / 100;
  const gosiEmployerMonthly = Math.round(gosiActive.reduce((s, g) => s + contributionFor(g, settings).employer, 0) * 100) / 100;

  const summaries: HorizonSummary[] = horizons.map((days) => {
    const byCategory = emptyByCategory();
    for (const l of lines) {
      if ((l.daysLeft ?? Infinity) > days) continue;
      byCategory[l.category].count++;
      byCategory[l.category].amount += l.amount;
    }
    const months = Math.max(1, Math.round(days / 30));
    byCategory.gosi = { count: months, amount: Math.round(gosiMonthly * months * 100) / 100 };
    const total = Math.round(Object.values(byCategory).reduce((s, c) => s + c.amount, 0) * 100) / 100;
    return { days, total, byCategory };
  });

  // Driver cards that do not exist yet but are required are a cost too (new issuance).
  const regulatedWithoutCard = new Set<string>();
  const cardHolders = new Set(input.driverCards.filter((c) => c.recordStatus === 'active').map((c) => c.driverId));
  for (const r of input.residents) {
    if (r.recordStatus === 'active' && isRegulatedDriverOccupation(r.occupation, settings) && !cardHolders.has(r.iqamaNumber)) regulatedWithoutCard.add(r.iqamaNumber);
  }

  return {
    lines: lines.sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0)),
    summaries,
    gosiMonthly,
    gosiEmployerMonthly,
    pendingNewDriverCards: { count: regulatedWithoutCard.size, amount: regulatedWithoutCard.size * settings.fees.driverCard },
  };
}

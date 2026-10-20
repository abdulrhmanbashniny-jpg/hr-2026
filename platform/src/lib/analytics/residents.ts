import { ageOn, daysUntil } from '@/lib/dates';
import type { ResidentRow } from '@/lib/rules/engine';
import type { TenantSettings } from '@/lib/settings';
import { countBy, matrixOf } from './common';

export function renewalConflict(r: Pick<ResidentRow, 'iqamaExpiry' | 'passportExpiry'>, today: string): boolean {
  if (!r.iqamaExpiry || !r.passportExpiry) return false;
  const iqamaDays = daysUntil(r.iqamaExpiry, today)!;
  if (iqamaDays > 90) return false;
  return daysUntil(r.passportExpiry, today)! <= 0 || r.passportExpiry < r.iqamaExpiry;
}

export function residentAnalytics(rows: ResidentRow[], today: string, settings: TenantSettings) {
  const active = rows.filter((r) => r.recordStatus === 'active');
  const outside = active.filter((r) => r.outsideKingdom);
  const seniors = active.filter((r) => (ageOn(r.birthDate, today) ?? 0) >= settings.seniorAge);
  const conflicts = active.filter((r) => renewalConflict(r, today));
  return {
    total: active.length,
    missing: rows.filter((r) => r.recordStatus === 'missing').length,
    byNationality: countBy(active, (r) => r.nationality),
    byOccupation: countBy(active, (r) => r.occupation),
    byGender: countBy(active, (r) => r.gender),
    iqamaMatrix: matrixOf(active.map((r) => r.iqamaExpiry), today),
    passportMatrix: matrixOf(active.map((r) => r.passportExpiry), today),
    outsideKingdom: outside.length,
    outsideKingdomAtRisk: outside.filter((r) => {
      const d = [daysUntil(r.iqamaExpiry, today), daysUntil(r.passportExpiry, today)].filter((x): x is number => x !== null);
      return d.some((x) => x <= 90);
    }).length,
    seniors: seniors.length,
    renewalConflicts: conflicts.length,
  };
}

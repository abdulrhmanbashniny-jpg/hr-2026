import { bucketFor } from '@/lib/dates';
import { isInsuranceValid, isRestricted, operatingCardRequirement } from '@/lib/rules/classify';
import type { OperatingCardRow, VehicleRow } from '@/lib/rules/engine';
import type { TenantSettings } from '@/lib/settings';
import { countBy, matrixOf } from './common';

export interface Readiness {
  ready: boolean;
  license: boolean;
  inspection: boolean;
  insurance: boolean;
  unrestricted: boolean;
  operatingCard: boolean;
}

/** Regulatory readiness: valid registration + inspection + insurance + no restriction (+ operating card when required). */
export function vehicleReadiness(v: VehicleRow, opCards: OperatingCardRow[], today: string, settings: TenantSettings): Readiness {
  const license = !!v.licenseExpiry && bucketFor(v.licenseExpiry, today) !== 'expired';
  const inspection = !!v.inspectionExpiry && bucketFor(v.inspectionExpiry, today) !== 'expired';
  const insurance = isInsuranceValid(v.insuranceStatus) !== false;
  const unrestricted = !isRestricted(v.restrictionStatus);
  const need = operatingCardRequirement(v, settings);
  const operatingCard =
    !need.required ||
    opCards.some((c) => c.sequenceNumber === v.sequenceNumber && c.recordStatus === 'active' && bucketFor(c.expiryDate, today) !== 'expired');
  return { ready: license && inspection && insurance && unrestricted && operatingCard, license, inspection, insurance, unrestricted, operatingCard };
}

export function fleetAnalytics(vehicleRows: VehicleRow[], opCards: OperatingCardRow[], today: string, settings: TenantSettings) {
  const active = vehicleRows.filter((v) => v.recordStatus === 'active');
  const readiness = active.map((v) => vehicleReadiness(v, opCards, today, settings));
  const year = Number(today.slice(0, 4));
  const ageBand = (y: number | null) => {
    if (!y) return '—';
    const age = year - y;
    if (age <= 3) return '0–3';
    if (age <= 7) return '4–7';
    if (age <= 12) return '8–12';
    return '13+';
  };
  const users = new Map<string, number>();
  for (const v of active) if (v.actualUserId) users.set(v.actualUserId, (users.get(v.actualUserId) ?? 0) + 1);
  const required = active.filter((v) => operatingCardRequirement(v, settings).required);
  const withCard = new Set(opCards.filter((c) => c.recordStatus === 'active' && c.sequenceNumber).map((c) => c.sequenceNumber));
  const ages = active.filter((v) => v.manufactureYear).map((v) => year - v.manufactureYear!);
  return {
    total: active.length,
    missing: vehicleRows.filter((v) => v.recordStatus === 'missing').length,
    ready: readiness.filter((r) => r.ready).length,
    readinessPct: active.length ? Math.round((readiness.filter((r) => r.ready).length / active.length) * 1000) / 10 : 0,
    failing: {
      license: readiness.filter((r) => !r.license).length,
      inspection: readiness.filter((r) => !r.inspection).length,
      insurance: readiness.filter((r) => !r.insurance).length,
      restricted: readiness.filter((r) => !r.unrestricted).length,
      operatingCard: readiness.filter((r) => !r.operatingCard).length,
    },
    licenseMatrix: matrixOf(active.map((v) => v.licenseExpiry), today),
    inspectionMatrix: matrixOf(active.map((v) => v.inspectionExpiry), today),
    opCardMatrix: matrixOf(opCards.filter((c) => c.recordStatus === 'active').map((c) => c.expiryDate), today),
    noUser: active.filter((v) => !v.actualUserId).length,
    overloadedUsers: [...users.values()].filter((n) => n > settings.maxVehiclesPerUser).length,
    averageAge: ages.length ? Math.round((ages.reduce((s, a) => s + a, 0) / ages.length) * 10) / 10 : null,
    byAge: ['0–3', '4–7', '8–12', '13+', '—']
      .map((name) => ({ name, count: active.filter((v) => ageBand(v.manufactureYear) === name).length }))
      .filter((x) => x.count > 0),
    byRegistrationType: countBy(active, (v) => v.registrationType),
    byBranch: countBy(active, (v) => v.branch),
    byMake: countBy(active, (v) => v.make),
    opCardRequired: required.length,
    opCardMissing: required.filter((v) => !withCard.has(v.sequenceNumber)).length,
  };
}

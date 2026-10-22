import { totalRisk, type RiskAssessment, type RiskReason } from './types';

export interface ReferralRiskInput {
  sameDeviceAsReferrer: boolean;
  /** Referrer and referee seen on the same IP /24 within the last 24 hours. */
  sameNetworkRecent: boolean;
  referrerReferralsLast24h: number;
  refereePhone: string;
  referrerPhone: string;
  /** Other accounts already seen on the referee's device. */
  sharedDeviceAccounts: number;
}

export const REFERRAL_HOLD_SCORE = 60;

/** Numeric distance between two mobile numbers: consecutive SIMs bought together sit within a few units. */
export function phoneDistance(a: string, b: string): number {
  const na = Number(a.replace(/\D/g, '').slice(-9));
  const nb = Number(b.replace(/\D/g, '').slice(-9));
  return Number.isFinite(na) && Number.isFinite(nb) ? Math.abs(na - nb) : Number.POSITIVE_INFINITY;
}

export function assessReferral(input: ReferralRiskInput): RiskAssessment & { hold: boolean } {
  const reasons: RiskReason[] = [];
  if (input.sameDeviceAsReferrer) reasons.push({ code: 'same_device_as_referrer', weight: 80 });
  if (input.sameNetworkRecent) reasons.push({ code: 'same_network_recent', weight: 30 });
  if (input.referrerReferralsLast24h >= 5) reasons.push({ code: 'referral_burst', weight: 25, detail: { last24h: input.referrerReferralsLast24h } });
  if (phoneDistance(input.refereePhone, input.referrerPhone) <= 10) reasons.push({ code: 'adjacent_phone', weight: 15 });
  if (input.sharedDeviceAccounts > 0) reasons.push({ code: 'shared_device', weight: 30, detail: { accounts: input.sharedDeviceAccounts } });
  const score = totalRisk(reasons);
  return { score, reasons, hold: score >= REFERRAL_HOLD_SCORE };
}

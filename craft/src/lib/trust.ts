import type { Tier } from '@/lib/incentives/engine';

export type CheckStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface TrustInput {
  tier: Tier;
  identityStatus: CheckStatus;
  licenseStatus: CheckStatus;
  projects: number;
  fieldVerifiedProjects: number;
  approvedInvoices: number;
  accountAgeDays: number;
  yearsExperience: number;
}

export type TrustPartKey = 'tier' | 'identity' | 'license' | 'portfolio' | 'purchases' | 'tenure';

export interface TrustPart {
  key: TrustPartKey;
  points: number;
  max: number;
}

/**
 * One explainable 0–100 number for clients, built only from facts the platform checked: the tier
 * staff assigned, identity and licence checks, projects (field-verified ones count four times),
 * purchases proven by approved invoices, and time on the platform plus declared experience.
 */
export function trustScore(input: TrustInput): { score: number; parts: TrustPart[] } {
  const parts: TrustPart[] = [
    { key: 'tier', max: 25, points: { A: 25, B: 15, C: 5 }[input.tier] },
    { key: 'identity', max: 20, points: input.identityStatus === 'verified' ? 20 : 0 },
    { key: 'license', max: 15, points: input.licenseStatus === 'verified' ? 15 : 0 },
    { key: 'portfolio', max: 15, points: Math.min(15, input.fieldVerifiedProjects * 4 + Math.max(0, input.projects - input.fieldVerifiedProjects)) },
    { key: 'purchases', max: 15, points: Math.min(15, input.approvedInvoices * 2) },
    { key: 'tenure', max: 10, points: Math.min(5, Math.floor(input.accountAgeDays / 36)) + Math.min(5, Math.floor(input.yearsExperience / 2)) },
  ];
  return { score: parts.reduce((s, p) => s + p.points, 0), parts };
}

export function trustBand(score: number): 'excellent' | 'strong' | 'growing' | 'new' {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'strong';
  if (score >= 35) return 'growing';
  return 'new';
}

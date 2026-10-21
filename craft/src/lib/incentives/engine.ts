import type { Economics } from '@/lib/settings/economics';

export type IncentiveTarget = 'invoice' | 'referral_bonus' | 'commission';
export type Tier = 'A' | 'B' | 'C';

export interface IncentiveRuleLike {
  id: string;
  name: string;
  target: IncentiveTarget;
  scope: 'national' | 'region' | 'city';
  regionCode: string | null;
  cityId: string | null;
  multiplier: number;
  flatBonus: number;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
}

export interface IncentiveContext {
  target: IncentiveTarget;
  cityId: string | null;
  regionCode: string | null;
  at: Date;
}

export interface IncentiveResult {
  multiplier: number;
  flatBonus: number;
  appliedRuleIds: string[];
  appliedRuleNames: string[];
}

export const NO_INCENTIVE: IncentiveResult = { multiplier: 1, flatBonus: 0, appliedRuleIds: [], appliedRuleNames: [] };

function matches(rule: IncentiveRuleLike, ctx: IncentiveContext): boolean {
  if (!rule.isActive || rule.target !== ctx.target) return false;
  if (ctx.at < rule.startsAt || ctx.at >= rule.endsAt) return false;
  if (rule.scope === 'city') return !!ctx.cityId && rule.cityId === ctx.cityId;
  if (rule.scope === 'region') return !!ctx.regionCode && rule.regionCode === ctx.regionCode;
  return true;
}

/**
 * Every active rule in its window that matches the target and the place applies. The highest
 * multiplier wins (multipliers never stack, so overlapping campaigns cannot run away), capped at
 * `maxMultiplier`; flat bonuses add up. The ids are kept so each payout records why it paid.
 */
export function resolveIncentive(rules: IncentiveRuleLike[], ctx: IncentiveContext, maxMultiplier: number): IncentiveResult {
  const hit = rules.filter((r) => matches(r, ctx));
  if (!hit.length) return NO_INCENTIVE;
  const best = Math.max(1, ...hit.map((r) => r.multiplier));
  return {
    multiplier: Math.min(best, maxMultiplier),
    flatBonus: hit.reduce((s, r) => s + Math.max(0, r.flatBonus), 0),
    appliedRuleIds: hit.map((r) => r.id),
    appliedRuleNames: hit.map((r) => r.name),
  };
}

export interface InvoicePoints {
  basePoints: number;
  points: number;
  tierMultiplier: number;
  incentive: IncentiveResult;
}

/** Points for an approved invoice: pre-VAT value × rate × tier × campaign, plus campaign bonuses. */
export function invoicePoints(input: { total: number; vat: number | null; tier: Tier; incentive: IncentiveResult }, eco: Economics): InvoicePoints {
  // Without a VAT figure the total is treated as VAT-inclusive at the standard 15 %.
  const vat = input.vat ?? input.total - input.total / 1.15;
  const net = Math.max(0, input.total - vat);
  const basePoints = Math.floor(net * eco.pointsPerSar);
  const tierMultiplier = eco.tierMultipliers[input.tier];
  const points = basePoints > 0 ? Math.floor(basePoints * tierMultiplier * input.incentive.multiplier) + input.incentive.flatBonus : 0;
  return { basePoints, points, tierMultiplier, incentive: input.incentive };
}

/**
 * Commissions are a share of the referee's base points (before tier and campaign multipliers, so
 * multipliers never compound up the chain). Two levels only, by design.
 */
export function commissionPoints(basePoints: number, level: 1 | 2, eco: Economics, incentive: IncentiveResult = NO_INCENTIVE): number {
  const pct = level === 1 ? eco.commissionL1Pct : eco.commissionL2Pct;
  const raw = Math.floor((basePoints * pct) / 100);
  return raw > 0 ? Math.floor(raw * incentive.multiplier) + incentive.flatBonus : 0;
}

export function referralBonusPoints(eco: Economics, incentive: IncentiveResult = NO_INCENTIVE): number {
  return Math.floor(eco.referralBonus * incentive.multiplier) + incentive.flatBonus;
}

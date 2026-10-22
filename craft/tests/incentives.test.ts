import { describe, expect, it } from 'vitest';
import { commissionPoints, invoicePoints, NO_INCENTIVE, referralBonusPoints, resolveIncentive, type IncentiveRuleLike } from '@/lib/incentives/engine';
import { DEFAULT_ECONOMICS as eco } from '@/lib/settings/economics';

const window = { startsAt: new Date('2026-10-01T00:00:00Z'), endsAt: new Date('2026-11-01T00:00:00Z'), isActive: true };
const rule = (r: Partial<IncentiveRuleLike> & Pick<IncentiveRuleLike, 'id'>): IncentiveRuleLike => ({
  name: r.id,
  target: 'invoice',
  scope: 'national',
  regionCode: null,
  cityId: null,
  multiplier: 1,
  flatBonus: 0,
  ...window,
  ...r,
});
const at = new Date('2026-10-15T12:00:00Z');
const riyadh = { target: 'invoice' as const, cityId: 'riyadh', regionCode: 'RIY', at };

describe('incentive resolution', () => {
  it('returns no incentive when nothing matches', () => {
    expect(resolveIncentive([], riyadh, 3)).toEqual(NO_INCENTIVE);
  });

  it('matches by city, region and nationally, takes the best multiplier and adds bonuses', () => {
    const rules = [
      rule({ id: 'national', multiplier: 1.2 }),
      rule({ id: 'region', scope: 'region', regionCode: 'RIY', multiplier: 1.5, flatBonus: 20 }),
      rule({ id: 'city', scope: 'city', cityId: 'riyadh', multiplier: 2, flatBonus: 30 }),
      rule({ id: 'dammam', scope: 'city', cityId: 'dammam', multiplier: 2.5 }),
    ];
    const r = resolveIncentive(rules, riyadh, 3);
    expect(r.multiplier).toBe(2);
    expect(r.flatBonus).toBe(50);
    expect(r.appliedRuleIds.sort()).toEqual(['city', 'national', 'region']);
  });

  it('ignores inactive rules, other targets and rules outside their window', () => {
    const rules = [
      rule({ id: 'off', multiplier: 2, isActive: false }),
      rule({ id: 'ref', target: 'referral_bonus', multiplier: 2 }),
      rule({ id: 'past', multiplier: 2, startsAt: new Date('2026-09-01'), endsAt: new Date('2026-10-01') }),
    ];
    expect(resolveIncentive(rules, riyadh, 3)).toEqual(NO_INCENTIVE);
  });

  it('caps runaway multipliers', () => {
    expect(resolveIncentive([rule({ id: 'x', multiplier: 9 })], riyadh, 3).multiplier).toBe(3);
  });

  it('treats the end of the window as exclusive', () => {
    const r = resolveIncentive([rule({ id: 'x', multiplier: 2 })], { ...riyadh, at: window.endsAt }, 3);
    expect(r).toEqual(NO_INCENTIVE);
  });
});

describe('points', () => {
  it('earns on the pre-VAT value with tier and campaign multipliers', () => {
    const inc = { ...NO_INCENTIVE, multiplier: 2, flatBonus: 50 };
    const r = invoicePoints({ total: 1150, vat: 150, tier: 'A', incentive: inc }, eco);
    expect(r.basePoints).toBe(1000);
    expect(r.points).toBe(Math.floor(1000 * 1.25 * 2) + 50);
  });

  it('assumes 15 % VAT-inclusive totals when VAT is unknown', () => {
    expect(invoicePoints({ total: 1150, vat: null, tier: 'C', incentive: NO_INCENTIVE }, eco).basePoints).toBe(1000);
  });

  it('pays commissions on base points only, two levels', () => {
    expect(commissionPoints(1000, 1, eco)).toBe(50);
    expect(commissionPoints(1000, 2, eco)).toBe(20);
    expect(commissionPoints(10, 2, eco)).toBe(0);
  });

  it('scales the referral bonus by campaign', () => {
    expect(referralBonusPoints(eco)).toBe(300);
    expect(referralBonusPoints(eco, { ...NO_INCENTIVE, multiplier: 1.5, flatBonus: 25 })).toBe(475);
  });
});

import { describe, expect, it } from 'vitest';
import { contributionFor, endOfServiceProvision } from '@/lib/analytics/gosi';
import { priceQuote, promoProblem } from '@/lib/billing/pricing';
import { notificationKey } from '@/lib/notifications/dispatch';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { gosi } from './factories';

const plan = { id: 'p', code: 'growth', nameAr: '', nameEn: '', descriptionAr: '', descriptionEn: '', priceMonthly: 69900, priceYearly: 699000, maxEmployees: null, maxVehicles: null, maxUsers: null, features: [], isActive: true, sortOrder: 1, createdAt: new Date() };
const promo = (p: object) => ({ id: 'x', code: 'X', kind: 'percent' as const, value: 20, validFrom: null, validUntil: null, maxRedemptions: null, redeemedCount: 0, planCodes: null, isActive: true, note: null, createdAt: new Date(), ...p });

describe('pricing and promo codes', () => {
  it('applies percent and fixed discounts before 15% VAT (amounts in halalas)', () => {
    expect(priceQuote(plan, 'monthly', null, 15)).toEqual({ subtotal: 69900, discount: 0, vat: 10485, total: 80385 });
    expect(priceQuote(plan, 'monthly', promo({ kind: 'percent', value: 20 }), 15)).toEqual({ subtotal: 69900, discount: 13980, vat: 8388, total: 64308 });
    expect(priceQuote(plan, 'yearly', promo({ kind: 'fixed', value: 50000 }), 15).discount).toBe(50000);
    expect(priceQuote(plan, 'monthly', promo({ kind: 'fixed', value: 999999 }), 15).total).toBe(0);
  });

  it('validates codes', () => {
    const now = new Date('2026-10-20T00:00:00Z');
    expect(promoProblem(undefined)).toBe('not_found');
    expect(promoProblem(promo({ isActive: false }), { now })).toBe('inactive');
    expect(promoProblem(promo({ validUntil: new Date('2026-01-01') }), { now })).toBe('expired');
    expect(promoProblem(promo({ validFrom: new Date('2027-01-01') }), { now })).toBe('not_started');
    expect(promoProblem(promo({ maxRedemptions: 3, redeemedCount: 3 }), { now })).toBe('exhausted');
    expect(promoProblem(promo({}), { now, alreadyRedeemed: true })).toBe('already_used');
    expect(promoProblem(promo({ planCodes: ['enterprise'] }), { now, planCode: 'growth' })).toBe('not_for_plan');
    expect(promoProblem(promo({}), { now, planCode: 'growth' })).toBeNull();
  });
});

describe('GOSI and end of service', () => {
  it('splits contributions by nationality and the 1445H system, capped at 45,000', () => {
    const s = DEFAULT_SETTINGS;
    expect(contributionFor(gosi({ isSaudi: true, contributoryWage: 10000 }), s)).toMatchObject({ employer: 1175, employee: 975 });
    expect(contributionFor(gosi({ isSaudi: true, newSystemEligible: true, contributoryWage: 10000 }), s)).toMatchObject({ employer: 1225, employee: 1025 });
    expect(contributionFor(gosi({ isSaudi: false, contributoryWage: 3000 }), s)).toMatchObject({ employer: 60, employee: 0 });
    expect(contributionFor(gosi({ isSaudi: true, contributoryWage: 60000 }), s).wage).toBe(45000);
  });

  it('accrues half a month per year for five years, then a full month (Article 84)', () => {
    const row = gosi({ joinDate: '2016-10-20', basicWage: 8000, housingAllowance: 2000, totalWage: 11000 });
    const eos = endOfServiceProvision(row, '2026-10-20', 'basic_housing');
    expect(eos.years).toBeCloseTo(10, 1);
    expect(eos.amount).toBeCloseTo(10000 * (5 * 0.5 + 5), -2);
    expect(endOfServiceProvision(row, '2026-10-20', 'total').monthlyWage).toBe(11000);
  });
});

describe('notification thresholds', () => {
  const a = (dueDate: string | null, severity: 'high' | 'info' = 'high') => ({ fingerprint: 'F', dueDate, severity });
  it('notifies once per crossed threshold and weekly after expiry', () => {
    const th = [60, 30, 7, 4];
    expect(notificationKey(a('2027-03-01'), th, '2026-10-20')).toBeNull();
    expect(notificationKey(a('2026-12-10'), th, '2026-10-20')).toBe('F:t60');
    expect(notificationKey(a('2026-11-10'), th, '2026-10-20')).toBe('F:t30');
    expect(notificationKey(a('2026-10-23'), th, '2026-10-20')).toBe('F:t4');
    expect(notificationKey(a('2026-10-01'), th, '2026-10-20')).toMatch(/^F:expired:2026W\d{2}$/);
    expect(notificationKey(a(null), th, '2026-10-20')).toBe('F:once');
    expect(notificationKey(a(null, 'info'), th, '2026-10-20')).toBeNull();
  });
});

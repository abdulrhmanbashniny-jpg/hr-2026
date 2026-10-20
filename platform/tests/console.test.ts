import { describe, expect, it } from 'vitest';
import { audienceMatches } from '@/lib/admin/announcements';
import { monthlyValue } from '@/lib/admin/metrics';
import { initials } from '@/components/app/topbar';
import { countOf } from '@/lib/i18n/format';

describe('announcement audiences', () => {
  const trial = { id: 't1', status: 'trialing', planId: 'p1' };
  const active = { id: 't2', status: 'active', planId: 'p2' };
  const pastDue = { id: 't3', status: 'past_due', planId: 'p2' };
  const canceled = { id: 't4', status: 'canceled', planId: null };
  it('matches by subscription stage', () => {
    expect(audienceMatches({ kind: 'all' }, canceled)).toBe(true);
    expect(audienceMatches({ kind: 'trialing' }, trial)).toBe(true);
    expect(audienceMatches({ kind: 'trialing' }, active)).toBe(false);
    expect(audienceMatches({ kind: 'active' }, pastDue)).toBe(true);
    expect(audienceMatches({ kind: 'expired' }, canceled)).toBe(true);
    expect(audienceMatches({ kind: 'expired' }, active)).toBe(false);
  });
  it('matches chosen plans and companies', () => {
    expect(audienceMatches({ kind: 'plan', planIds: ['p2'] }, active)).toBe(true);
    expect(audienceMatches({ kind: 'plan', planIds: ['p2'] }, trial)).toBe(false);
    expect(audienceMatches({ kind: 'plan', planIds: ['p2'] }, canceled)).toBe(false);
    expect(audienceMatches({ kind: 'tenants', tenantIds: ['t1', 't4'] }, canceled)).toBe(true);
    expect(audienceMatches({ kind: 'tenants', tenantIds: ['t1'] }, active)).toBe(false);
  });
});

describe('monthly recurring revenue', () => {
  const plan = { priceMonthly: 69_900, priceYearly: 699_000 };
  it('counts paying subscriptions only, spreading yearly prices over 12 months', () => {
    expect(monthlyValue({ status: 'active', billingCycle: 'monthly' }, plan)).toBe(69_900);
    expect(monthlyValue({ status: 'past_due', billingCycle: 'yearly' }, plan)).toBe(58_250);
    expect(monthlyValue({ status: 'trialing', billingCycle: 'monthly' }, plan)).toBe(0);
    expect(monthlyValue({ status: 'expired', billingCycle: 'monthly' }, plan)).toBe(0);
    expect(monthlyValue({ status: 'active', billingCycle: 'monthly' }, undefined)).toBe(0);
  });
});

describe('Arabic counts', () => {
  it('uses the right number form', () => {
    expect(countOf(1, 'company', 'ar')).toBe('شركة واحدة');
    expect(countOf(2, 'company', 'ar')).toBe('شركتان');
    expect(countOf(3, 'company', 'ar')).toBe('3 شركات');
    expect(countOf(10, 'user', 'ar')).toBe('10 مستخدمين');
    expect(countOf(11, 'company', 'ar')).toBe('11 شركة');
    expect(countOf(1250, 'user', 'ar')).toBe('1,250 مستخدم');
    expect(countOf(1, 'company', 'en')).toBe('1 company');
    expect(countOf(4, 'payment', 'en')).toBe('4 payments');
  });
});

describe('avatar initials', () => {
  it('skips the legal form and the article in Arabic names', () => {
    expect(initials('شركة النخبة للنقل')).toBe('ن');
    expect(initials('مؤسسة الرواد للمقاولات')).toBe('ر');
    expect(initials('عبدالرحمن الشهري')).toBe('ع');
    expect(initials('Platform Admin')).toBe('PA');
  });
});

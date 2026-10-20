import type { plans, promoCodes } from '@/db/schema';

type Plan = typeof plans.$inferSelect;
type Promo = typeof promoCodes.$inferSelect;

export type PromoProblem = 'not_found' | 'inactive' | 'not_started' | 'expired' | 'exhausted' | 'already_used' | 'not_for_plan';

export function promoProblem(promo: Promo | undefined, opts: { now?: Date; planCode?: string | null; alreadyRedeemed?: boolean } = {}): PromoProblem | null {
  const now = opts.now ?? new Date();
  if (!promo) return 'not_found';
  if (!promo.isActive) return 'inactive';
  if (promo.validFrom && promo.validFrom > now) return 'not_started';
  if (promo.validUntil && promo.validUntil < now) return 'expired';
  if (promo.maxRedemptions !== null && promo.redeemedCount >= promo.maxRedemptions) return 'exhausted';
  if (opts.alreadyRedeemed) return 'already_used';
  if (opts.planCode && promo.planCodes && promo.planCodes.length && !promo.planCodes.includes(opts.planCode)) return 'not_for_plan';
  return null;
}

/** All amounts in halalas. VAT applies after the discount. */
export function priceQuote(plan: Plan, cycle: 'monthly' | 'yearly', promo: Promo | null, vatPercent: number) {
  const subtotal = cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
  let discount = 0;
  if (promo?.kind === 'percent') discount = Math.round((subtotal * Math.min(100, Math.max(0, promo.value))) / 100);
  if (promo?.kind === 'fixed') discount = Math.min(subtotal, promo.value);
  const net = subtotal - discount;
  const vat = Math.round((net * vatPercent) / 100);
  return { subtotal, discount, vat, total: net + vat };
}

export function formatSar(halalas: number, locale: 'ar' | 'en' = 'ar'): string {
  const sar = halalas / 100;
  const n = new Intl.NumberFormat('en', { minimumFractionDigits: sar % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(sar);
  return locale === 'ar' ? `${n} ر.س` : `SAR ${n}`;
}

export function periodEnd(start: Date, cycle: 'monthly' | 'yearly'): Date {
  const d = new Date(start);
  if (cycle === 'yearly') d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

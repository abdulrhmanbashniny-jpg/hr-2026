import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { payments, promoCodes, promoRedemptions, subscriptions } from '@/db/schema';
import { audit } from '@/lib/audit';
import { periodEnd } from './pricing';

/** Marks a payment as paid and activates (or extends) the tenant's subscription. Idempotent. */
export async function activatePayment(paymentId: string, actorUserId: string | null, providerRef?: string) {
  const [p] = await db.select().from(payments).where(eq(payments.id, paymentId));
  if (!p || p.status === 'paid') return p ?? null;
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(payments).set({ status: 'paid', paidAt: now, providerRef: providerRef ?? p.providerRef }).where(eq(payments.id, p.id));
    const [sub] = await tx.select().from(subscriptions).where(eq(subscriptions.tenantId, p.tenantId));
    // Extend from the later of now and the current paid period, so early renewals are not lost.
    const base = sub?.status === 'active' && sub.currentPeriodEnd && sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now;
    const values = {
      planId: p.planId,
      status: 'active' as const,
      billingCycle: p.billingCycle,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd(base, p.billingCycle),
      cancelAtPeriodEnd: false,
      pendingPromoCodeId: null,
      updatedAt: now,
    };
    if (sub) await tx.update(subscriptions).set(values).where(eq(subscriptions.id, sub.id));
    else await tx.insert(subscriptions).values({ ...values, tenantId: p.tenantId });
    if (p.promoCodeId) {
      const inserted = await tx.insert(promoRedemptions).values({ promoCodeId: p.promoCodeId, tenantId: p.tenantId }).onConflictDoNothing().returning();
      if (inserted.length) await tx.update(promoCodes).set({ redeemedCount: sql`${promoCodes.redeemedCount} + 1` }).where(eq(promoCodes.id, p.promoCodeId));
    }
  });
  await audit({ tenantId: p.tenantId, userId: actorUserId, action: 'billing.payment_paid', entityType: 'payment', entityId: p.id, summary: `دفعة مؤكدة ${(p.total / 100).toFixed(2)} ر.س (${p.provider})` }, null);
  return { ...p, status: 'paid' as const };
}

export async function failPayment(paymentId: string) {
  await db.update(payments).set({ status: 'failed' }).where(and(eq(payments.id, paymentId), eq(payments.status, 'pending')));
}

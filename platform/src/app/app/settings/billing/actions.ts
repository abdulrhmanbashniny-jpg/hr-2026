'use server';

import { and, eq, inArray, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { payments, plans, promoCodes, promoRedemptions, subscriptions } from '@/db/schema';
import type { ActionResult } from '@/lib/action-result';
import { runAction, str } from '@/lib/actions';
import { audit } from '@/lib/audit';
import { requirePermission } from '@/lib/auth/guards';
import { createInvoice, moyasarEnabled } from '@/lib/billing/moyasar';
import { formatSar, priceQuote, promoProblem } from '@/lib/billing/pricing';
import { env } from '@/lib/env';
import { f, getI18n } from '@/lib/i18n';

async function loadPromo(code: string, tenantId: string) {
  if (!code) return { promo: undefined, alreadyRedeemed: false };
  const [promo] = await db.select().from(promoCodes).where(eq(promoCodes.code, code.toUpperCase()));
  const [red] = promo
    ? await db.select().from(promoRedemptions).where(and(eq(promoRedemptions.promoCodeId, promo.id), eq(promoRedemptions.tenantId, tenantId)))
    : [];
  return { promo: promo ?? undefined, alreadyRedeemed: !!red || (promo ? await promoInUse(promo.id, tenantId) : false) };
}

/** A code counts as used once a payment with it is pending or paid, so one code cannot fund several checkouts. */
async function promoInUse(promoCodeId: string, tenantId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.promoCodeId, promoCodeId), eq(payments.tenantId, tenantId), inArray(payments.status, ['pending', 'paid'])))
    .limit(1);
  return !!row;
}

export interface QuoteData {
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  promoDescription: string | null;
}

export async function quote(planId: string, cycle: 'monthly' | 'yearly', code: string): Promise<ActionResult<QuoteData>> {
  return runAction(async () => {
    const s = await requirePermission('billing:manage', { allowReadOnly: true });
    const { t, locale } = await getI18n();
    const [plan] = await db.select().from(plans).where(and(eq(plans.id, planId), eq(plans.isActive, true)));
    if (!plan) return { ok: false, error: t.common.error };
    const { promo, alreadyRedeemed } = await loadPromo(code, s.tenant.id);
    let applied = null;
    if (code) {
      const why = promoProblem(promo, { planCode: plan.code, alreadyRedeemed });
      if (why) return { ok: false, error: f(t.auth.promoInvalid, { reason: t.promoProblems[why] }) };
      if (promo!.kind === 'trial_extension') return { ok: false, error: f(t.auth.promoInvalid, { reason: t.promoProblems.not_for_plan }) };
      applied = promo!;
    }
    const q = priceQuote(plan, cycle, applied, env.vatPercent);
    const desc = applied ? (applied.kind === 'percent' ? `${applied.value}%` : formatSar(applied.value, locale)) : null;
    return { ok: true, data: { ...q, promoDescription: desc } };
  });
}

export async function applyTrialExtension(code: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requirePermission('billing:manage', { allowReadOnly: true });
    const { t } = await getI18n();
    const { promo, alreadyRedeemed } = await loadPromo(code, s.tenant.id);
    const why = promoProblem(promo, { alreadyRedeemed });
    if (why) return { ok: false, error: f(t.auth.promoInvalid, { reason: t.promoProblems[why] }) };
    if (promo!.kind !== 'trial_extension') return { ok: false, error: f(t.auth.promoInvalid, { reason: t.promoProblems.not_for_plan }) };
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.tenantId, s.tenant.id));
    if (!sub || (sub.status !== 'trialing' && sub.status !== 'expired') || sub.currentPeriodEnd) return { ok: false, error: f(t.auth.promoInvalid, { reason: t.promoProblems.not_for_plan }) };
    const base = sub.trialEndsAt && sub.trialEndsAt > new Date() ? sub.trialEndsAt : new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(subscriptions)
        .set({ status: 'trialing', trialEndsAt: new Date(base.getTime() + promo!.value * 86_400_000), updatedAt: new Date() })
        .where(eq(subscriptions.id, sub.id));
      await tx.insert(promoRedemptions).values({ promoCodeId: promo!.id, tenantId: s.tenant.id });
      await tx.update(promoCodes).set({ redeemedCount: sql`${promoCodes.redeemedCount} + 1` }).where(eq(promoCodes.id, promo!.id));
    });
    await audit({ tenantId: s.tenant.id, userId: s.user.id, action: 'billing.trial_extended', entityType: 'subscription', entityId: sub.id, summary: `تمديد التجربة ${promo!.value} يوماً بالكود ${promo!.code}` });
    revalidatePath('/app', 'layout');
    return { ok: true, message: f(t.billing.trialExtended, { days: promo!.value }) };
  });
}

export async function checkout(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const result = await runAction<{ url?: string }>(async () => {
    const s = await requirePermission('billing:manage', { allowReadOnly: true });
    const { t } = await getI18n();
    const planId = str(form, 'planId');
    const cycle = str(form, 'cycle') === 'yearly' ? 'yearly' : 'monthly';
    const code = str(form, 'promo').toUpperCase();
    const manual = str(form, 'manual') === '1';
    const [plan] = await db.select().from(plans).where(and(eq(plans.id, planId), eq(plans.isActive, true)));
    if (!plan) return { ok: false, error: t.common.error };
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.tenantId, s.tenant.id));
    let promo = null;
    if (code) {
      const loaded = await loadPromo(code, s.tenant.id);
      const why = promoProblem(loaded.promo, { planCode: plan.code, alreadyRedeemed: loaded.alreadyRedeemed });
      if (why || loaded.promo!.kind === 'trial_extension') return { ok: false, error: f(t.auth.promoInvalid, { reason: t.promoProblems[why ?? 'not_for_plan'] }) };
      promo = loaded.promo!;
    } else if (sub?.pendingPromoCodeId) {
      const [p] = await db.select().from(promoCodes).where(eq(promoCodes.id, sub.pendingPromoCodeId));
      if (p && !promoProblem(p, { planCode: plan.code }) && p.kind !== 'trial_extension' && !(await promoInUse(p.id, s.tenant.id))) promo = p;
    }
    const q = priceQuote(plan, cycle, promo, env.vatPercent);
    const useGateway = !manual && moyasarEnabled();
    const [payment] = await db
      .insert(payments)
      .values({
        tenantId: s.tenant.id,
        planId: plan.id,
        billingCycle: cycle,
        subtotal: q.subtotal,
        discount: q.discount,
        vat: q.vat,
        total: q.total,
        promoCodeId: promo?.id ?? null,
        provider: useGateway ? 'moyasar' : 'manual',
        createdBy: s.user.id,
      })
      .returning();
    await audit({ tenantId: s.tenant.id, userId: s.user.id, action: 'billing.checkout_started', entityType: 'payment', entityId: payment.id, summary: `طلب اشتراك ${plan.nameAr} (${cycle}) بقيمة ${(q.total / 100).toFixed(2)} ر.س${promo ? ` بكود ${promo.code}` : ''}` });
    if (!useGateway) {
      revalidatePath('/app/settings/billing');
      return { ok: true, message: t.billing.manualRequested };
    }
    const invoice = await createInvoice({ amount: q.total, description: `Mutabaa ${plan.nameEn} (${cycle}) — ${s.tenant.name}`, paymentId: payment.id, tenantId: s.tenant.id });
    await db.update(payments).set({ providerRef: invoice.id, checkoutUrl: invoice.url }).where(eq(payments.id, payment.id));
    return { ok: true, data: { url: invoice.url } };
  });
  if (result.ok && result.data?.url) redirect(result.data.url);
  return result;
}

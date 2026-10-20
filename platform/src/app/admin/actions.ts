'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { payments, plans, promoCodes } from '@/db/schema';
import type { ActionResult } from '@/lib/action-result';
import { bool, num, optStr, runAction, str } from '@/lib/actions';
import { audit } from '@/lib/audit';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { activatePayment } from '@/lib/billing/activate';
import { env } from '@/lib/env';
import { f, getI18n } from '@/lib/i18n';
import { runDailyJob } from '@/lib/notifications/dispatch';
import { setWebhook, telegramEnabled } from '@/lib/notifications/telegram';

export async function savePlan(id: string | null, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireSuperAdmin();
    const { t } = await getI18n();
    const code = str(form, 'code').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!code || str(form, 'nameAr').length < 2) return { ok: false, error: t.common.error };
    const limit = (k: string) => (str(form, k) ? Math.max(0, Math.trunc(num(form, k))) : null);
    const values = {
      code,
      nameAr: str(form, 'nameAr'),
      nameEn: str(form, 'nameEn') || str(form, 'nameAr'),
      descriptionAr: str(form, 'descriptionAr'),
      descriptionEn: str(form, 'descriptionEn'),
      priceMonthly: Math.round(num(form, 'priceMonthly') * 100),
      priceYearly: Math.round(num(form, 'priceYearly') * 100),
      maxEmployees: limit('maxEmployees'),
      maxVehicles: limit('maxVehicles'),
      maxUsers: limit('maxUsers'),
      isActive: bool(form, 'isActive'),
      sortOrder: Math.trunc(num(form, 'sortOrder')),
    };
    if (id) await db.update(plans).set(values).where(eq(plans.id, id));
    else await db.insert(plans).values(values);
    await audit({ tenantId: null, userId: s.user.id, action: id ? 'admin.plan_updated' : 'admin.plan_created', entityType: 'plan', entityId: id ?? undefined, summary: `${id ? 'تحديث' : 'إنشاء'} باقة ${values.nameAr}` });
    revalidatePath('/admin/plans');
    return { ok: true, message: t.settings.saved };
  });
}

export async function savePromo(id: string | null, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireSuperAdmin();
    const { t } = await getI18n();
    const code = str(form, 'code').toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    const kind = str(form, 'kind') as 'percent' | 'fixed' | 'trial_extension';
    if (!code || !['percent', 'fixed', 'trial_extension'].includes(kind)) return { ok: false, error: t.common.error };
    const raw = num(form, 'value');
    const value = kind === 'fixed' ? Math.round(raw * 100) : Math.trunc(raw);
    if (value <= 0 || (kind === 'percent' && value > 100)) return { ok: false, error: t.common.error };
    const date = (k: string) => (str(form, k) ? new Date(`${str(form, k)}T23:59:59+03:00`) : null);
    const values = {
      code,
      kind,
      value,
      validFrom: str(form, 'validFrom') ? new Date(`${str(form, 'validFrom')}T00:00:00+03:00`) : null,
      validUntil: date('validUntil'),
      maxRedemptions: str(form, 'maxRedemptions') ? Math.trunc(num(form, 'maxRedemptions')) : null,
      planCodes: form.getAll('planCodes').map(String).filter(Boolean).length ? form.getAll('planCodes').map(String).filter(Boolean) : null,
      isActive: bool(form, 'isActive'),
      note: optStr(form, 'note'),
    };
    if (id) await db.update(promoCodes).set(values).where(eq(promoCodes.id, id));
    else await db.insert(promoCodes).values(values);
    await audit({ tenantId: null, userId: s.user.id, action: id ? 'admin.promo_updated' : 'admin.promo_created', entityType: 'promo', entityId: id ?? undefined, summary: `${id ? 'تحديث' : 'إنشاء'} كود ${code}` });
    revalidatePath('/admin/promos');
    return { ok: true, message: t.settings.saved };
  });
}

export async function approvePayment(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireSuperAdmin();
    const { t } = await getI18n();
    const p = await activatePayment(id, s.user.id);
    if (!p) return { ok: false, error: t.common.error };
    revalidatePath('/admin/payments');
    return { ok: true, message: t.settings.saved };
  });
}

export async function cancelPayment(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireSuperAdmin();
    const { t } = await getI18n();
    await db.update(payments).set({ status: 'canceled' }).where(eq(payments.id, id));
    revalidatePath('/admin/payments');
    return { ok: true, message: t.settings.saved };
  });
}

export async function registerTelegramWebhook(): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireSuperAdmin();
    const { t } = await getI18n();
    if (!telegramEnabled() || !env.telegram.webhookSecret) return { ok: false, error: t.settings.botNotConfigured };
    const url = `${env.appUrl}/api/telegram/webhook`;
    await setWebhook(url, env.telegram.webhookSecret);
    await audit({ tenantId: null, userId: s.user.id, action: 'admin.telegram_webhook', summary: `ضبط Webhook البوت على ${url}` });
    return { ok: true, message: f(t.admin.webhookSet, { url }) };
  });
}

export async function runDailyNow(): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireSuperAdmin();
    const { t } = await getI18n();
    const r = await runDailyJob();
    await audit({ tenantId: null, userId: s.user.id, action: 'admin.daily_job', summary: `تشغيل المهمة اليومية يدوياً (${r.tenants} شركة)`, metadata: { ...r } });
    const sent = r.delivered.inApp + r.delivered.telegram + r.delivered.whatsapp + r.delivered.email;
    return { ok: true, message: f(t.admin.dailyDone, { tenants: r.tenants, opened: r.opened, sent }) };
  });
}

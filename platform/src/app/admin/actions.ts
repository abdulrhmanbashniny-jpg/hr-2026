'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { payments, plans, promoCodes } from '@/db/schema';
import type { ActionResult } from '@/lib/action-result';
import { bool, num, optStr, runAction, str } from '@/lib/actions';
import { audit } from '@/lib/audit';
import { requireStaff } from '@/lib/auth/guards';
import { activatePayment } from '@/lib/billing/activate';
import { env } from '@/lib/env';
import { f, getI18n } from '@/lib/i18n';
import { encryptSecret } from '@/lib/crypto';
import { runDailyJob } from '@/lib/notifications/dispatch';
import { emailLayout, testPlatformSmtp } from '@/lib/notifications/email';
import { getPlatformSmtp, savePlatformSmtp, type PlatformSmtp } from '@/lib/platform-settings';
import { platformBot, setCommands, setWebhook } from '@/lib/notifications/telegram';

export async function savePlan(id: string | null, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireStaff('billing:manage');
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
    const s = await requireStaff('billing:manage');
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
    const s = await requireStaff('billing:manage');
    const { t } = await getI18n();
    const p = await activatePayment(id, s.user.id);
    if (!p) return { ok: false, error: t.common.error };
    revalidatePath('/admin/payments');
    return { ok: true, message: t.settings.saved };
  });
}

export async function cancelPayment(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireStaff('billing:manage');
    const { t } = await getI18n();
    await db.update(payments).set({ status: 'canceled' }).where(eq(payments.id, id));
    revalidatePath('/admin/payments');
    return { ok: true, message: t.settings.saved };
  });
}

export async function registerTelegramWebhook(): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireStaff('system:manage');
    const { t } = await getI18n();
    const bot = platformBot();
    if (!bot || !env.telegram.webhookSecret) return { ok: false, error: t.console.system.platformBotOff };
    const url = `${env.appUrl}/api/telegram/webhook`;
    await setWebhook(bot, url, env.telegram.webhookSecret);
    await setCommands(bot).catch(() => undefined);
    await audit({ tenantId: null, userId: s.user.id, action: 'admin.telegram_webhook', summary: `ضبط Webhook البوت على ${url}` });
    return { ok: true, message: f(t.admin.webhookSet, { url }) };
  });
}

export async function runDailyNow(): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireStaff('system:manage');
    const { t } = await getI18n();
    const r = await runDailyJob();
    await audit({ tenantId: null, userId: s.user.id, action: 'admin.daily_job', summary: `تشغيل المهمة اليومية يدوياً (${r.tenants} شركة)`, metadata: { ...r } });
    const sent = r.delivered.inApp + r.delivered.telegram + r.delivered.whatsapp + r.delivered.email;
    return { ok: true, message: f(t.admin.dailyDone, { tenants: r.tenants, opened: r.opened, sent }) };
  });
}

// ───────────────────────── Platform mail ─────────────────────────

async function readSmtp(form: FormData): Promise<PlatformSmtp> {
  const current = await getPlatformSmtp();
  const password = str(form, 'smtpPassword');
  return {
    enabled: bool(form, 'smtpEnabled'),
    host: str(form, 'smtpHost').slice(0, 200),
    port: Math.min(65535, Math.max(1, num(form, 'smtpPort', 587))),
    secure: bool(form, 'smtpSecure'),
    user: str(form, 'smtpUser').slice(0, 200),
    passwordEnc: password ? encryptSecret(password) : (current?.passwordEnc ?? null),
    fromName: str(form, 'smtpFromName').slice(0, 120),
    fromEmail: str(form, 'smtpFromEmail').slice(0, 200),
  };
}

export async function savePlatformMail(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireStaff('system:manage');
    const { t } = await getI18n();
    const next = await readSmtp(form);
    if (next.enabled && (!next.host || !(next.fromEmail || next.user))) return { ok: false, error: t.console.system.mailMissing };
    await savePlatformSmtp(next, s.user.id);
    await audit({ tenantId: null, userId: s.user.id, action: 'admin.platform_mail', summary: next.enabled ? `ضبط بريد المنصة على ${next.host}` : 'إيقاف بريد المنصة المضبوط من اللوحة' });
    revalidatePath('/admin', 'layout');
    return { ok: true, message: t.console.system.mailSaved };
  });
}

/** Tries the settings in the form (saved or not) by sending a message to the signed-in admin. */
export async function testPlatformMail(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireStaff('system:manage');
    const { t } = await getI18n();
    const smtp = await readSmtp(form);
    if (!smtp.host || !(smtp.fromEmail || smtp.user)) return { ok: false, error: t.console.system.mailMissing };
    try {
      await testPlatformSmtp(smtp, s.user.email, {
        subject: 'متابعة · اختبار بريد المنصة',
        html: emailLayout('اختبار بريد المنصة', '<p>بريد المنصة يعمل. ستصل روابط استعادة كلمة المرور ودعوات الفريق والإعلانات من هذا المرسل.</p>', 'منصة متابعة'),
        text: 'بريد المنصة يعمل.',
      });
    } catch (err) {
      return { ok: false, error: `SMTP: ${err instanceof Error ? err.message : String(err)}` };
    }
    return { ok: true, message: f(t.console.system.mailTestSent, { email: s.user.email }) };
  });
}

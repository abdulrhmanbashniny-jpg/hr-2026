'use server';

import { and, count, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { contacts, invitations, memberships, tenants, users } from '@/db/schema';
import type { ActionResult } from '@/lib/action-result';
import { bool, lines, num, optStr, runAction, str } from '@/lib/actions';
import { audit } from '@/lib/audit';
import { ForbiddenError, requirePermission } from '@/lib/auth/guards';
import { ROLES, type Role } from '@/lib/auth/rbac';
import { encryptSecret, randomToken, sha256 } from '@/lib/crypto';
import { env } from '@/lib/env';
import { f, getI18n } from '@/lib/i18n';
import { emailEnabled, emailLayout, sendEmail, verifySmtp } from '@/lib/notifications/email';
import { telegramDeepLink } from '@/lib/notifications/telegram';
import { syncTenantAlerts } from '@/lib/rules/sync';
import { tenantSettingsSchema, type TenantSettings } from '@/lib/settings';

async function saveSettings(tenantId: string, next: TenantSettings) {
  const parsed = tenantSettingsSchema.parse(next);
  await db.update(tenants).set({ settings: parsed, updatedAt: new Date() }).where(eq(tenants.id, tenantId));
}

export async function updateCompany(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requirePermission('settings:manage', { allowReadOnly: true });
    const { t } = await getI18n();
    const name = str(form, 'name').slice(0, 120);
    const cr = str(form, 'crNumber');
    if (name.length < 2 || (cr && !/^\d{10}$/.test(cr))) return { ok: false, error: t.common.error };
    await db.update(tenants).set({ name, crNumber: cr || null, updatedAt: new Date() }).where(eq(tenants.id, s.tenant.id));
    await audit({ tenantId: s.tenant.id, userId: s.user.id, action: 'tenant.updated', entityType: 'tenant', entityId: s.tenant.id, summary: `تحديث بيانات الشركة: ${name}` });
    revalidatePath('/app', 'layout');
    return { ok: true, message: t.settings.saved };
  });
}

export async function updateRules(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requirePermission('settings:manage', { allowReadOnly: true });
    const { t } = await getI18n();
    const cur = s.settings;
    const days = lines(form, 'templateAlertDays')
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 365);
    const next: TenantSettings = {
      ...cur,
      templateAlertDays: [...new Set(days)].sort((a, b) => b - a).slice(0, 8).length ? [...new Set(days)].sort((a, b) => b - a).slice(0, 8) : cur.templateAlertDays,
      probationDays: num(form, 'probationDays') === 180 ? 180 : 90,
      probationAlertLeadDays: Math.min(60, Math.max(1, num(form, 'probationAlertLeadDays', cur.probationAlertLeadDays))),
      saudiMinContributoryWage: Math.max(0, num(form, 'saudiMinContributoryWage', cur.saudiMinContributoryWage)),
      seniorAge: Math.min(80, Math.max(40, num(form, 'seniorAge', cur.seniorAge))),
      maxVehiclesPerUser: Math.min(20, Math.max(1, num(form, 'maxVehiclesPerUser', cur.maxVehiclesPerUser))),
      heavyDriverOccupations: lines(form, 'heavyDriverOccupations').slice(0, 50),
      excludedDriverOccupations: lines(form, 'excludedDriverOccupations').slice(0, 50),
      operatingCardRegistrationTypes: lines(form, 'operatingCardRegistrationTypes').slice(0, 20),
      lightVehicleKeywords: lines(form, 'lightVehicleKeywords').slice(0, 50),
      fees: {
        iqamaRenewal: num(form, 'fee_iqamaRenewal', cur.fees.iqamaRenewal),
        workPermit: num(form, 'fee_workPermit', cur.fees.workPermit),
        operatingCard: num(form, 'fee_operatingCard', cur.fees.operatingCard),
        driverCard: num(form, 'fee_driverCard', cur.fees.driverCard),
        inspection: num(form, 'fee_inspection', cur.fees.inspection),
        vehicleLicense: num(form, 'fee_vehicleLicense', cur.fees.vehicleLicense),
      },
      gosi: {
        saudiEmployerPct: num(form, 'gosi_saudiEmployerPct', cur.gosi.saudiEmployerPct),
        saudiEmployeePct: num(form, 'gosi_saudiEmployeePct', cur.gosi.saudiEmployeePct),
        saudiNewEmployerPct: num(form, 'gosi_saudiNewEmployerPct', cur.gosi.saudiNewEmployerPct),
        saudiNewEmployeePct: num(form, 'gosi_saudiNewEmployeePct', cur.gosi.saudiNewEmployeePct),
        nonSaudiEmployerPct: num(form, 'gosi_nonSaudiEmployerPct', cur.gosi.nonSaudiEmployerPct),
        maxContributoryWage: num(form, 'gosi_maxContributoryWage', cur.gosi.maxContributoryWage),
      },
      eosWageBasis: str(form, 'eosWageBasis') === 'total' ? 'total' : 'basic_housing',
      weeklyReportDay: Math.min(6, Math.max(0, num(form, 'weeklyReportDay', cur.weeklyReportDay))),
    };
    const check = tenantSettingsSchema.safeParse(next);
    if (!check.success) return { ok: false, error: `${t.common.error} (${check.error.issues[0]?.path.join('.')})` };
    await saveSettings(s.tenant.id, check.data);
    await audit({ tenantId: s.tenant.id, userId: s.user.id, action: 'settings.rules_updated', entityType: 'tenant', entityId: s.tenant.id, summary: 'تحديث قواعد المتابعة والرسوم' });
    await syncTenantAlerts(s.tenant.id);
    revalidatePath('/app', 'layout');
    return { ok: true, message: t.settings.saved };
  });
}

export async function updateSmtp(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requirePermission('settings:manage', { allowReadOnly: true });
    const { t } = await getI18n();
    const password = str(form, 'smtpPassword');
    const next: TenantSettings = {
      ...s.settings,
      smtp: {
        enabled: bool(form, 'smtpEnabled'),
        host: str(form, 'smtpHost').slice(0, 200),
        port: Math.min(65535, Math.max(1, num(form, 'smtpPort', 587))),
        secure: bool(form, 'smtpSecure'),
        user: str(form, 'smtpUser').slice(0, 200),
        passwordEnc: password ? encryptSecret(password) : s.settings.smtp.passwordEnc,
        fromName: str(form, 'smtpFromName').slice(0, 120),
        fromEmail: str(form, 'smtpFromEmail').slice(0, 200),
      },
    };
    if (next.smtp.enabled && !next.smtp.host) return { ok: false, error: `${t.settings.smtpHost}: ${t.common.required}` };
    await saveSettings(s.tenant.id, next);
    await audit({ tenantId: s.tenant.id, userId: s.user.id, action: 'settings.smtp_updated', entityType: 'tenant', entityId: s.tenant.id, summary: `تحديث إعدادات البريد (${next.smtp.enabled ? next.smtp.host : 'بريد المنصة'})` });
    revalidatePath('/app/settings');
    return { ok: true, message: t.settings.saved };
  });
}

export async function testSmtp(): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requirePermission('settings:manage', { allowReadOnly: true });
    const { t } = await getI18n();
    try {
      await verifySmtp(s.settings);
      await sendEmail(s.settings, {
        to: s.user.email,
        subject: 'متابعة · رسالة اختبار',
        html: emailLayout(s.tenant.name, '<p>تم إعداد البريد بنجاح. ستصل التنبيهات والتقارير من هذا المرسل.</p>', 'منصة متابعة'),
        text: 'تم إعداد البريد بنجاح.',
      });
    } catch (err) {
      return { ok: false, error: `SMTP: ${err instanceof Error ? err.message : String(err)}` };
    }
    return { ok: true, message: f(t.settings.testSent, { email: s.user.email }) };
  });
}

export async function updateWhatsapp(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requirePermission('settings:manage', { allowReadOnly: true });
    const { t } = await getI18n();
    const mode = str(form, 'waMode');
    const token = str(form, 'waToken');
    const auth = str(form, 'waWebhookAuth');
    const webhookUrl = str(form, 'waWebhookUrl');
    if (webhookUrl && !/^https:\/\//i.test(webhookUrl)) return { ok: false, error: `${t.settings.waWebhookUrl}: https://` };
    const next: TenantSettings = {
      ...s.settings,
      whatsapp: {
        mode: mode === 'cloud_api' || mode === 'webhook' ? mode : 'deeplink',
        cloudPhoneNumberId: str(form, 'waPhoneId').slice(0, 64),
        cloudTokenEnc: token ? encryptSecret(token) : s.settings.whatsapp.cloudTokenEnc,
        cloudTemplateName: str(form, 'waTemplate').slice(0, 120),
        cloudTemplateLang: str(form, 'waTemplateLang').slice(0, 10) || 'ar',
        webhookUrl: webhookUrl.slice(0, 500),
        webhookAuthHeaderEnc: auth ? encryptSecret(auth) : s.settings.whatsapp.webhookAuthHeaderEnc,
      },
    };
    await saveSettings(s.tenant.id, next);
    await audit({ tenantId: s.tenant.id, userId: s.user.id, action: 'settings.whatsapp_updated', entityType: 'tenant', entityId: s.tenant.id, summary: `تحديث إعدادات واتساب (${next.whatsapp.mode})` });
    revalidatePath('/app/settings');
    return { ok: true, message: t.settings.saved };
  });
}

// ───────── Team ─────────

export async function inviteMember(_prev: ActionResult<{ url: string }> | null, form: FormData): Promise<ActionResult<{ url: string }>> {
  return runAction(async () => {
    const s = await requirePermission('members:manage', { allowReadOnly: true });
    const { t } = await getI18n();
    const email = str(form, 'email').toLowerCase();
    const role = str(form, 'role') as Role;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !ROLES.includes(role)) return { ok: false, error: t.common.error };
    if (role === 'owner' && s.role !== 'owner') throw new ForbiddenError();
    const [existing] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.tenantId, s.tenant.id), eq(users.email, email)));
    if (existing) return { ok: false, error: t.auth.emailTaken };
    const token = randomToken(32);
    await db.insert(invitations).values({ tenantId: s.tenant.id, email, role, tokenHash: sha256(token), invitedBy: s.user.id, expiresAt: new Date(Date.now() + 7 * 86_400_000) });
    const url = `${env.appUrl}/invite/${token}`;
    if (emailEnabled(s.settings)) {
      await sendEmail(s.settings, {
        to: email,
        subject: `دعوة للانضمام إلى ${s.tenant.name} على منصة متابعة`,
        html: emailLayout(s.tenant.name, `<p>دعاك ${s.user.name} للانضمام إلى مساحة عمل <b>${s.tenant.name}</b> بدور «${t.roles[role]}».</p><p><a href="${url}" style="color:#0f5b4b">قبول الدعوة</a> (صالحة 7 أيام)</p>`, 'منصة متابعة'),
        text: `دعوة للانضمام إلى ${s.tenant.name}: ${url}`,
      }).catch((err) => console.error('invite mail failed', err));
    }
    await audit({ tenantId: s.tenant.id, userId: s.user.id, action: 'member.invited', entityType: 'invitation', summary: `دعوة ${email} بدور ${role}` });
    revalidatePath('/app/settings');
    return { ok: true, message: t.settings.inviteSent, data: { url } };
  });
}

async function ownerCount(tenantId: string) {
  const [r] = await db.select({ n: count() }).from(memberships).where(and(eq(memberships.tenantId, tenantId), eq(memberships.role, 'owner')));
  return r.n;
}

export async function changeRole(membershipId: string, role: Role): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requirePermission('members:manage', { allowReadOnly: true });
    const { t } = await getI18n();
    if (!ROLES.includes(role)) return { ok: false, error: t.common.error };
    const [m] = await db.select().from(memberships).where(and(eq(memberships.id, membershipId), eq(memberships.tenantId, s.tenant.id)));
    if (!m) return { ok: false, error: t.common.error };
    if ((role === 'owner' || m.role === 'owner') && s.role !== 'owner') throw new ForbiddenError();
    if (m.role === 'owner' && role !== 'owner' && (await ownerCount(s.tenant.id)) <= 1) return { ok: false, error: t.settings.lastOwner };
    await db.update(memberships).set({ role }).where(eq(memberships.id, m.id));
    await audit({ tenantId: s.tenant.id, userId: s.user.id, action: 'member.role_changed', entityType: 'membership', entityId: m.id, summary: `تغيير الدور ${m.role} → ${role}` });
    revalidatePath('/app/settings');
    return { ok: true, message: t.settings.saved };
  });
}

export async function removeMember(membershipId: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requirePermission('members:manage', { allowReadOnly: true });
    const { t } = await getI18n();
    const [m] = await db.select().from(memberships).where(and(eq(memberships.id, membershipId), eq(memberships.tenantId, s.tenant.id)));
    if (!m) return { ok: false, error: t.common.error };
    if (m.role === 'owner' && (s.role !== 'owner' || (await ownerCount(s.tenant.id)) <= 1)) return { ok: false, error: t.settings.lastOwner };
    await db.delete(memberships).where(eq(memberships.id, m.id));
    await audit({ tenantId: s.tenant.id, userId: s.user.id, action: 'member.removed', entityType: 'membership', entityId: m.id, summary: 'إزالة عضو من الفريق' });
    revalidatePath('/app/settings');
    return { ok: true, message: t.settings.saved };
  });
}

export async function revokeInvitation(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requirePermission('members:manage', { allowReadOnly: true });
    const { t } = await getI18n();
    await db.delete(invitations).where(and(eq(invitations.id, id), eq(invitations.tenantId, s.tenant.id), isNull(invitations.acceptedAt)));
    revalidatePath('/app/settings');
    return { ok: true, message: t.settings.saved };
  });
}

// ───────── Responsible people ─────────

const MODULES = ['residents', 'gosi', 'fleet', 'operating_cards', 'driver_cards', 'documents', 'cross'];

export async function saveContact(id: string | null, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requirePermission('contacts:manage', { allowReadOnly: true });
    const { t } = await getI18n();
    const name = str(form, 'name').slice(0, 120);
    if (name.length < 2) return { ok: false, error: `${t.common.name}: ${t.common.required}` };
    const email = optStr(form, 'email');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: t.common.error };
    const values = {
      name,
      jobTitle: optStr(form, 'jobTitle')?.slice(0, 120) ?? null,
      phone: optStr(form, 'phone')?.slice(0, 20) ?? null,
      email: email?.toLowerCase() ?? null,
      modules: form.getAll('modules').map(String).filter((m) => MODULES.includes(m)),
      canRequestDocuments: bool(form, 'canRequestDocuments'),
      receiveWeeklyReport: bool(form, 'receiveWeeklyReport'),
    };
    if (id) {
      await db.update(contacts).set(values).where(and(eq(contacts.id, id), eq(contacts.tenantId, s.tenant.id)));
    } else {
      await db.insert(contacts).values({ ...values, tenantId: s.tenant.id, telegramLinkCode: randomToken(12) });
    }
    await audit({ tenantId: s.tenant.id, userId: s.user.id, action: id ? 'contact.updated' : 'contact.created', entityType: 'contact', entityId: id ?? undefined, summary: `${id ? 'تحديث' : 'إضافة'} مسؤول متابعة: ${name}` });
    revalidatePath('/app/settings');
    return { ok: true, message: t.settings.saved };
  });
}

export async function deleteContact(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requirePermission('contacts:manage', { allowReadOnly: true });
    const { t } = await getI18n();
    const [c] = await db.delete(contacts).where(and(eq(contacts.id, id), eq(contacts.tenantId, s.tenant.id))).returning();
    if (c) await audit({ tenantId: s.tenant.id, userId: s.user.id, action: 'contact.deleted', entityType: 'contact', entityId: id, summary: `حذف مسؤول متابعة: ${c.name}` });
    revalidatePath('/app/settings');
    return { ok: true, message: t.settings.saved };
  });
}

export async function regenerateTelegramLink(id: string): Promise<ActionResult<{ url: string | null }>> {
  return runAction(async () => {
    const s = await requirePermission('contacts:manage', { allowReadOnly: true });
    const { t } = await getI18n();
    const code = randomToken(12);
    await db.update(contacts).set({ telegramLinkCode: code }).where(and(eq(contacts.id, id), eq(contacts.tenantId, s.tenant.id)));
    revalidatePath('/app/settings');
    return { ok: true, message: t.settings.saved, data: { url: telegramDeepLink(code) } };
  });
}

export async function unlinkTelegram(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requirePermission('contacts:manage', { allowReadOnly: true });
    const { t } = await getI18n();
    await db
      .update(contacts)
      .set({ telegramChatId: null, telegramUsername: null, telegramLinkCode: randomToken(12) })
      .where(and(eq(contacts.id, id), eq(contacts.tenantId, s.tenant.id)));
    await audit({ tenantId: s.tenant.id, userId: s.user.id, action: 'contact.telegram_unlinked', entityType: 'contact', entityId: id, summary: 'فك ربط التليجرام' });
    revalidatePath('/app/settings');
    return { ok: true, message: t.settings.saved };
  });
}

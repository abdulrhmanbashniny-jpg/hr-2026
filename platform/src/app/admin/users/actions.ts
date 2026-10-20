'use server';

import { and, eq, inArray, isNull, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { memberships, passwordResets, sessions, tenants, users } from '@/db/schema';
import type { ActionResult } from '@/lib/action-result';
import { runAction, str } from '@/lib/actions';
import { audit } from '@/lib/audit';
import { staffCan } from '@/lib/admin/staff';
import { isLastOwner } from '@/lib/admin/team';
import { ForbiddenError, requireStaff } from '@/lib/auth/guards';
import type { SessionContext } from '@/lib/auth/session';
import { hashPassword, passwordProblem } from '@/lib/auth/password';
import { randomToken, sha256 } from '@/lib/crypto';
import { env } from '@/lib/env';
import { f, getI18n } from '@/lib/i18n';
import { emailEnabled, emailLayout, sendEmail } from '@/lib/notifications/email';
import { escapeHtml } from '@/lib/notifications/telegram';

function refresh(userId: string) {
  revalidatePath('/admin', 'layout');
  revalidatePath(`/admin/users/${userId}`);
}

/**
 * Only someone who manages the platform team may act on a team member's account, so a support agent
 * cannot, say, issue themselves a reset link for an owner.
 */
async function guardTarget(actor: SessionContext, userId: string) {
  if (userId === actor.user.id) return;
  const [target] = await db.select({ isSuperAdmin: users.isSuperAdmin }).from(users).where(eq(users.id, userId));
  if (target?.isSuperAdmin && !staffCan(actor.user.staffRole, 'team:manage')) throw new ForbiddenError('forbidden');
}

async function revokeAll(userId: string) {
  await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

export async function updateUserProfile(userId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireStaff('users:manage');
    await guardTarget(s, userId);
    const { t } = await getI18n();
    const name = str(form, 'name');
    const email = str(form, 'email').toLowerCase();
    const phone = str(form, 'phone');
    if (name.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: t.common.error };
    const [taken] = await db.select({ id: users.id }).from(users).where(and(eq(users.email, email), ne(users.id, userId)));
    if (taken) return { ok: false, error: t.console.users.emailTaken };
    await db.update(users).set({ name, email, phone: phone || null }).where(eq(users.id, userId));
    await audit({ tenantId: null, userId: s.user.id, action: 'admin.user_updated', entityType: 'user', entityId: userId, summary: `تعديل ملف المستخدم ${email}` });
    refresh(userId);
    return { ok: true, message: t.console.users.profileSaved };
  });
}

export async function setUserDisabled(userId: string, disabled: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireStaff('users:manage');
    await guardTarget(s, userId);
    const { t } = await getI18n();
    if (userId === s.user.id) return { ok: false, error: t.console.users.cannotSelf };
    if (disabled && (await isLastOwner(userId))) return { ok: false, error: t.console.users.lastAdmin };
    await db.update(users).set({ disabledAt: disabled ? new Date() : null }).where(eq(users.id, userId));
    if (disabled) await revokeAll(userId);
    await audit({ tenantId: null, userId: s.user.id, action: disabled ? 'admin.user_disabled' : 'admin.user_enabled', entityType: 'user', entityId: userId, summary: disabled ? 'إيقاف حساب مستخدم' : 'تفعيل حساب مستخدم' });
    refresh(userId);
    return { ok: true, message: disabled ? t.console.users.disabledOk : t.console.users.enabledOk };
  });
}

export async function revokeUserSessions(userId: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireStaff('users:support');
    await guardTarget(s, userId);
    const { t } = await getI18n();
    if (userId === s.user.id) return { ok: false, error: t.console.users.cannotSelf };
    await revokeAll(userId);
    await audit({ tenantId: null, userId: s.user.id, action: 'admin.sessions_revoked', entityType: 'user', entityId: userId, summary: 'إنهاء كل جلسات مستخدم' });
    refresh(userId);
    return { ok: true, message: t.console.users.sessionsRevoked };
  });
}

export async function revokeSession(sessionId: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireStaff('users:support');
    const { t } = await getI18n();
    if (sessionId === s.sessionId) return { ok: false, error: t.console.users.cannotSelf };
    const [row] = await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId)).returning({ userId: sessions.userId });
    if (row) refresh(row.userId);
    return { ok: true, message: t.console.users.sessionsRevoked };
  });
}

export async function setSuperAdmin(userId: string, grant: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireStaff('team:manage');
    const { t } = await getI18n();
    if (!grant && userId === s.user.id) return { ok: false, error: t.console.users.cannotSelf };
    if (!grant && (await isLastOwner(userId))) return { ok: false, error: t.console.users.lastAdmin };
    await db.update(users).set({ isSuperAdmin: grant, staffRole: grant ? 'admin' : null }).where(eq(users.id, userId));
    await audit({ tenantId: null, userId: s.user.id, action: grant ? 'admin.admin_granted' : 'admin.admin_revoked', entityType: 'user', entityId: userId, summary: grant ? 'منح صلاحية مدير المنصة' : 'سحب صلاحية مدير المنصة' });
    refresh(userId);
    return { ok: true, message: grant ? t.console.users.adminGranted : t.console.users.adminRevoked };
  });
}

export async function createResetLink(userId: string): Promise<ActionResult<{ link: string; emailed: boolean }>> {
  return runAction(async () => {
    const s = await requireStaff('users:support');
    await guardTarget(s, userId);
    const { t } = await getI18n();
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return { ok: false, error: t.common.error };
    const token = randomToken(32);
    await db.insert(passwordResets).values({ userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60_000) });
    const link = `${env.appUrl}/reset-password/${token}`;
    let emailed = false;
    if (await emailEnabled(null)) {
      emailed = await sendEmail(null, {
        to: user.email,
        subject: 'متابعة · إعادة تعيين كلمة المرور',
        html: emailLayout('إعادة تعيين كلمة المرور', `<p>مرحباً ${escapeHtml(user.name)}،</p><p>أنشأ فريق المنصة رابطاً لإعادة تعيين كلمة مرورك، صالحاً لمدة ساعة:</p><p><a href="${link}" style="color:#007aff">${link}</a></p>`, 'منصة متابعة'),
        text: `إعادة تعيين كلمة المرور: ${link}`,
      })
        .then(() => true)
        .catch(() => false);
    }
    await audit({ tenantId: null, userId: s.user.id, action: 'admin.reset_link', entityType: 'user', entityId: userId, summary: `إنشاء رابط إعادة تعيين كلمة المرور لـ ${user.email}` });
    return { ok: true, data: { link, emailed } };
  });
}

export async function setUserPassword(userId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireStaff('users:manage');
    await guardTarget(s, userId);
    const { t } = await getI18n();
    const password = str(form, 'password');
    const problem = passwordProblem(password);
    if (problem) return { ok: false, error: t.auth[problem as 'password_too_short' | 'password_too_weak'] };
    await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, userId));
    if (userId !== s.user.id) await revokeAll(userId);
    await audit({ tenantId: null, userId: s.user.id, action: 'admin.password_set', entityType: 'user', entityId: userId, summary: 'تعيين كلمة مرور مؤقتة من إدارة المنصة' });
    refresh(userId);
    return { ok: true, message: t.console.users.passwordSet };
  });
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    const s = await requireStaff('users:manage');
    await guardTarget(s, userId);
    const { t } = await getI18n();
    if (userId === s.user.id) return { ok: false, error: t.console.users.cannotSelf };
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return { ok: false, error: t.common.error };
    if (await isLastOwner(userId)) return { ok: false, error: t.console.users.lastAdmin };
    const owned = await db.select({ tenantId: memberships.tenantId }).from(memberships).where(and(eq(memberships.userId, userId), eq(memberships.role, 'owner')));
    if (owned.length) {
      const others = await db
        .select({ tenantId: memberships.tenantId })
        .from(memberships)
        .where(and(inArray(memberships.tenantId, owned.map((o) => o.tenantId)), eq(memberships.role, 'owner'), ne(memberships.userId, userId)));
      const covered = new Set(others.map((o) => o.tenantId));
      const sole = owned.filter((o) => !covered.has(o.tenantId)).map((o) => o.tenantId);
      if (sole.length) {
        const names = await db.select({ name: tenants.name }).from(tenants).where(inArray(tenants.id, sole));
        return { ok: false, error: f(t.console.users.soleOwner, { names: names.map((n) => n.name).join('، ') }) };
      }
    }
    await db.delete(users).where(eq(users.id, userId));
    await audit({ tenantId: null, userId: s.user.id, action: 'admin.user_deleted', entityType: 'user', entityId: userId, summary: `حذف المستخدم ${user.email}`, metadata: { email: user.email, name: user.name } });
    revalidatePath('/admin', 'layout');
    return { ok: true, message: t.console.users.deleted };
  });
  if (result.ok) redirect('/admin/users');
  return result;
}

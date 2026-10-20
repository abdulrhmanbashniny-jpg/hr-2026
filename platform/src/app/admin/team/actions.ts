'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { passwordResets, users } from '@/db/schema';
import type { ActionResult } from '@/lib/action-result';
import { runAction, str } from '@/lib/actions';
import { isStaffRole } from '@/lib/admin/staff';
import { isLastOwner } from '@/lib/admin/team';
import { audit } from '@/lib/audit';
import { requireStaff } from '@/lib/auth/guards';
import { hashPassword } from '@/lib/auth/password';
import { randomToken, sha256 } from '@/lib/crypto';
import { env } from '@/lib/env';
import { f, getI18n } from '@/lib/i18n';
import { emailEnabled, emailLayout, escapeHtml, sendEmail } from '@/lib/notifications/email';

const INVITE_DAYS = 7;

type Invite = { link: string | null; emailed: boolean; name: string };

function refresh() {
  revalidatePath('/admin', 'layout');
}

/**
 * Adds someone to the platform team. A registered e-mail is promoted in place; a new one gets an
 * account with an unusable password and a one-time link to set their own.
 */
export async function addStaff(_prev: ActionResult<Invite> | null, form: FormData): Promise<ActionResult<Invite>> {
  return runAction<Invite>(async () => {
    const s = await requireStaff('team:manage');
    const { t } = await getI18n();
    const c = t.console.team;
    const email = str(form, 'email').toLowerCase();
    const role = str(form, 'role');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: `${c.email}: ${t.common.error}` };
    if (!isStaffRole(role)) return { ok: false, error: `${c.role}: ${t.common.required}` };

    const [existing] = await db.select().from(users).where(eq(users.email, email));
    if (existing) {
      if (existing.isSuperAdmin) return { ok: false, error: c.already };
      if (existing.disabledAt) return { ok: false, error: c.disabledUser };
      await db.update(users).set({ isSuperAdmin: true, staffRole: role }).where(eq(users.id, existing.id));
      await audit({ tenantId: null, userId: s.user.id, action: 'admin.staff_added', entityType: 'user', entityId: existing.id, summary: `إضافة ${existing.email} إلى فريق المنصة (${c.roles[role]})` });
      refresh();
      return { ok: true, message: f(c.added, { name: existing.name }), data: { link: null, emailed: false, name: existing.name } };
    }

    const name = str(form, 'name').slice(0, 120);
    if (name.length < 2) return { ok: false, error: `${c.name}: ${t.common.required}` };
    const [user] = await db
      .insert(users)
      .values({ email, name, passwordHash: await hashPassword(randomToken(32)), isSuperAdmin: true, staffRole: role })
      .returning({ id: users.id });
    const token = randomToken(32);
    await db.insert(passwordResets).values({ userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000) });
    const link = `${env.appUrl}/reset-password/${token}`;
    let emailed = false;
    if (await emailEnabled(null)) {
      emailed = await sendEmail(null, {
        to: email,
        subject: 'متابعة · دعوة للانضمام إلى فريق إدارة المنصة',
        html: emailLayout(
          'دعوة لفريق المنصة',
          `<p>مرحباً ${escapeHtml(name)}،</p><p>أضافك ${escapeHtml(s.user.name)} إلى فريق إدارة منصة متابعة بدور <b>${escapeHtml(c.roles[role])}</b>.</p><p>عيّن كلمة مرورك من الرابط التالي (صالح ${INVITE_DAYS} أيام):</p><p><a href="${link}" style="color:#007aff">${link}</a></p>`,
          'منصة متابعة',
        ),
        text: `أضافك ${s.user.name} إلى فريق إدارة منصة متابعة. عيّن كلمة مرورك: ${link}`,
      })
        .then(() => true)
        .catch(() => false);
    }
    await audit({ tenantId: null, userId: s.user.id, action: 'admin.staff_invited', entityType: 'user', entityId: user.id, summary: `دعوة ${email} إلى فريق المنصة (${c.roles[role]})` });
    refresh();
    return { ok: true, data: { link, emailed, name } };
  });
}

export async function changeStaffRole(userId: string, role: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireStaff('team:manage');
    const { t } = await getI18n();
    const c = t.console.team;
    if (!isStaffRole(role)) return { ok: false, error: t.common.error };
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user?.isSuperAdmin) return { ok: false, error: t.common.error };
    if (role !== 'owner' && (await isLastOwner(userId))) return { ok: false, error: t.console.users.lastAdmin };
    await db.update(users).set({ staffRole: role }).where(eq(users.id, userId));
    await audit({ tenantId: null, userId: s.user.id, action: 'admin.staff_role', entityType: 'user', entityId: userId, summary: `تغيير دور ${user.email} في فريق المنصة إلى ${c.roles[role]}` });
    refresh();
    return { ok: true, message: c.roleChanged };
  });
}

export async function removeStaff(userId: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireStaff('team:manage');
    const { t } = await getI18n();
    if (userId === s.user.id) return { ok: false, error: t.console.users.cannotSelf };
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user?.isSuperAdmin) return { ok: false, error: t.common.error };
    if (await isLastOwner(userId)) return { ok: false, error: t.console.users.lastAdmin };
    await db.update(users).set({ isSuperAdmin: false, staffRole: null }).where(eq(users.id, userId));
    await audit({ tenantId: null, userId: s.user.id, action: 'admin.staff_removed', entityType: 'user', entityId: userId, summary: `إزالة ${user.email} من فريق المنصة` });
    refresh();
    return { ok: true, message: t.console.team.removed };
  });
}

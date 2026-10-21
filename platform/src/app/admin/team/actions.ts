'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { sessions, staffInvites, users } from '@/db/schema';
import type { ActionResult } from '@/lib/action-result';
import { runAction, str } from '@/lib/actions';
import { isStaffRole } from '@/lib/admin/staff';
import { isLastOwner } from '@/lib/admin/team';
import { audit } from '@/lib/audit';
import { requireStaff } from '@/lib/auth/guards';
import { randomToken, sha256 } from '@/lib/crypto';
import { env } from '@/lib/env';
import { getI18n } from '@/lib/i18n';
import { emailEnabled, emailLayout, escapeHtml, sendEmail } from '@/lib/notifications/email';

const INVITE_DAYS = 7;

type Invite = { link: string; emailed: boolean; email: string };

function refresh() {
  revalidatePath('/admin', 'layout');
}

/** Signs a team member out everywhere, so a role change or removal applies at once. */
async function revokeAllSessions(userId: string) {
  await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

/**
 * Invites someone to the platform team. Nothing changes on any account until the recipient opens
 * the link sent to that address and sets a new password: that proves they own the e-mail, and the
 * acceptance replaces any existing password and ends the account's other sessions. Registering an
 * account with someone else's address therefore never leads to a platform role.
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

    const [existing] = await db.select({ isSuperAdmin: users.isSuperAdmin, disabledAt: users.disabledAt }).from(users).where(eq(users.email, email));
    if (existing?.isSuperAdmin) return { ok: false, error: c.already };
    if (existing?.disabledAt) return { ok: false, error: c.disabledUser };

    // One live invitation per address.
    await db
      .update(staffInvites)
      .set({ revokedAt: new Date() })
      .where(and(eq(staffInvites.email, email), isNull(staffInvites.acceptedAt), isNull(staffInvites.revokedAt)));
    const token = randomToken(32);
    await db.insert(staffInvites).values({ email, role, tokenHash: sha256(token), invitedBy: s.user.id, expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000) });
    const link = `${env.appUrl}/staff-invite/${token}`;

    let emailed = false;
    if (await emailEnabled(null)) {
      emailed = await sendEmail(null, {
        to: email,
        subject: 'متابعة · دعوة للانضمام إلى فريق إدارة المنصة',
        html: emailLayout(
          'دعوة لفريق المنصة',
          `<p>دعاك ${escapeHtml(s.user.name)} للانضمام إلى فريق إدارة منصة متابعة بدور <b>${escapeHtml(c.roles[role])}</b>.</p><p>افتح الرابط وعيّن كلمة مرور جديدة لتفعيل الدور (صالح ${INVITE_DAYS} أيام ولمرة واحدة):</p><p><a href="${link}" style="color:#007aff">${link}</a></p>`,
          'منصة متابعة',
        ),
        text: `دعاك ${s.user.name} للانضمام إلى فريق إدارة منصة متابعة. فعّل الدور من الرابط: ${link}`,
      })
        .then(() => true)
        .catch(() => false);
    }
    await audit({ tenantId: null, userId: s.user.id, action: 'admin.staff_invited', entityType: 'staff_invite', summary: `دعوة ${email} إلى فريق المنصة (${c.roles[role]})` });
    refresh();
    return { ok: true, data: { link, emailed, email } };
  });
}

export async function revokeStaffInvite(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireStaff('team:manage');
    const { t } = await getI18n();
    const [row] = await db
      .update(staffInvites)
      .set({ revokedAt: new Date() })
      .where(and(eq(staffInvites.id, id), isNull(staffInvites.acceptedAt), isNull(staffInvites.revokedAt)))
      .returning({ email: staffInvites.email });
    if (!row) return { ok: false, error: t.common.error };
    await audit({ tenantId: null, userId: s.user.id, action: 'admin.staff_invite_revoked', entityType: 'staff_invite', entityId: id, summary: `إلغاء دعوة ${row.email} لفريق المنصة` });
    refresh();
    return { ok: true, message: t.console.team.inviteRevoked };
  });
}

export async function changeStaffRole(userId: string, role: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireStaff('team:manage');
    const { t } = await getI18n();
    const c = t.console.team;
    if (!isStaffRole(role)) return { ok: false, error: t.common.error };
    if (userId === s.user.id) return { ok: false, error: t.console.users.cannotSelf };
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user?.isSuperAdmin) return { ok: false, error: t.common.error };
    if (role !== 'owner' && (await isLastOwner(userId))) return { ok: false, error: t.console.users.lastAdmin };
    await db.update(users).set({ staffRole: role }).where(eq(users.id, userId));
    // A narrower role must not survive in sessions opened under the old one (e.g. support access to a company).
    await revokeAllSessions(userId);
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
    await revokeAllSessions(userId);
    await audit({ tenantId: null, userId: s.user.id, action: 'admin.staff_removed', entityType: 'user', entityId: userId, summary: `إزالة ${user.email} من فريق المنصة` });
    refresh();
    return { ok: true, message: t.console.team.removed };
  });
}

'use server';

import { and, eq, gt, isNull } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { passwordResets, sessions, staffInvites, users } from '@/db/schema';
import type { ActionResult } from '@/lib/action-result';
import { str } from '@/lib/actions';
import { isStaffRole } from '@/lib/admin/staff';
import { audit } from '@/lib/audit';
import { hashPassword, passwordProblem } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { sha256 } from '@/lib/crypto';
import { getI18n } from '@/lib/i18n';

/**
 * Accepting a platform-team invitation. The link was sent to the invited address, so opening it
 * proves ownership of the e-mail. The new password replaces any existing one and every earlier
 * session of that account ends, so whoever registered the address before cannot use the role.
 */
export async function acceptStaffInvite(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { t } = await getI18n();
  const token = str(form, 'token');
  const password = str(form, 'password');
  if (password !== str(form, 'confirm')) return { ok: false, error: t.console.team.passwordMismatch };
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: t.auth[problem as 'password_too_short' | 'password_too_weak'] };

  const now = new Date();
  const [invite] = await db
    .select()
    .from(staffInvites)
    .where(and(eq(staffInvites.tokenHash, sha256(token)), isNull(staffInvites.acceptedAt), isNull(staffInvites.revokedAt), gt(staffInvites.expiresAt, now)));
  if (!invite || !isStaffRole(invite.role)) return { ok: false, error: t.auth.inviteInvalid };

  const [existing] = await db.select().from(users).where(eq(users.email, invite.email));
  if (existing?.disabledAt) return { ok: false, error: t.console.team.disabledUser };
  const name = str(form, 'name').slice(0, 120);
  if (!existing && name.length < 2) return { ok: false, error: `${t.auth.fullName}: ${t.common.required}` };

  // Claim the invitation first so a token can only ever be used once, even with parallel requests.
  const [claimed] = await db
    .update(staffInvites)
    .set({ acceptedAt: now })
    .where(and(eq(staffInvites.id, invite.id), isNull(staffInvites.acceptedAt), isNull(staffInvites.revokedAt)))
    .returning({ id: staffInvites.id });
  if (!claimed) return { ok: false, error: t.auth.inviteInvalid };

  const passwordHash = await hashPassword(password);
  let userId: string;
  if (existing) {
    userId = existing.id;
    await db.update(users).set({ passwordHash, isSuperAdmin: true, staffRole: invite.role }).where(eq(users.id, userId));
    await db.update(sessions).set({ revokedAt: now }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
    await db.update(passwordResets).set({ usedAt: now }).where(and(eq(passwordResets.userId, userId), isNull(passwordResets.usedAt)));
  } else {
    const [created] = await db.insert(users).values({ email: invite.email, name, passwordHash, isSuperAdmin: true, staffRole: invite.role }).returning({ id: users.id });
    userId = created.id;
  }
  await audit({ tenantId: null, userId, action: 'admin.staff_joined', entityType: 'user', entityId: userId, summary: `قبول دعوة فريق المنصة (${t.console.team.roles[invite.role]})${existing ? ' مع تعيين كلمة مرور جديدة وإنهاء الجلسات السابقة' : ''}` });
  await createSession(userId, null);
  redirect('/admin');
}

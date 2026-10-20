'use server';

import { and, count, eq, isNotNull, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { documents, memberships, plans, sessions, subscriptions, tenantNotes, tenants, users } from '@/db/schema';
import type { ActionResult } from '@/lib/action-result';
import { num, runAction, str } from '@/lib/actions';
import { audit } from '@/lib/audit';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { hashPassword, passwordProblem } from '@/lib/auth/password';
import type { Role } from '@/lib/auth/rbac';
import { setActiveTenant } from '@/lib/auth/session';
import { f, getI18n } from '@/lib/i18n';
import { consoleAr } from '@/lib/i18n/console-ar';
import { storage } from '@/lib/storage';

const ROLES: Role[] = ['owner', 'general_manager', 'hr_officer', 'fleet_officer', 'viewer'];
const STATUSES = ['trialing', 'active', 'past_due', 'canceled', 'expired'] as const;

/** End of the given Riyadh calendar day, from a YYYY-MM-DD form value. */
function endOfDay(v: string): Date | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T23:59:59+03:00`) : null;
}

function refresh(tenantId?: string) {
  revalidatePath('/admin', 'layout');
  if (tenantId) revalidatePath(`/admin/tenants/${tenantId}`);
}

async function tenantOr404(tenantId: string) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  return tenant ?? null;
}

export async function extendTrial(tenantId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireSuperAdmin();
    const { t } = await getI18n();
    const days = Math.min(365, Math.max(1, Math.trunc(num(form, 'days', 7))));
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.tenantId, tenantId));
    const base = sub?.trialEndsAt && sub.trialEndsAt > new Date() ? sub.trialEndsAt : new Date();
    const trialEndsAt = new Date(base.getTime() + days * 86_400_000);
    if (sub) await db.update(subscriptions).set({ status: 'trialing', trialEndsAt, updatedAt: new Date() }).where(eq(subscriptions.id, sub.id));
    else await db.insert(subscriptions).values({ tenantId, status: 'trialing', trialEndsAt });
    await audit({ tenantId, userId: s.user.id, action: 'admin.trial_extended', entityType: 'subscription', entityId: sub?.id, summary: `تمديد التجربة ${days} يوماً من إدارة المنصة`, metadata: { days } });
    refresh(tenantId);
    return { ok: true, message: f(t.console.tenants.extended, { n: days }) };
  });
}

export async function updateSubscription(tenantId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireSuperAdmin();
    const { t } = await getI18n();
    const planId = str(form, 'planId') || null;
    if (planId) {
      const [plan] = await db.select({ id: plans.id }).from(plans).where(eq(plans.id, planId));
      if (!plan) return { ok: false, error: t.common.error };
    }
    const status = str(form, 'status') as (typeof STATUSES)[number];
    if (!STATUSES.includes(status)) return { ok: false, error: t.common.error };
    const billingCycle: 'monthly' | 'yearly' = str(form, 'cycle') === 'yearly' ? 'yearly' : 'monthly';
    const now = new Date();
    const values = {
      planId,
      status,
      billingCycle,
      trialEndsAt: endOfDay(str(form, 'trialEndsAt')),
      currentPeriodEnd: endOfDay(str(form, 'currentPeriodEnd')),
      updatedAt: now,
    };
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.tenantId, tenantId));
    if (sub) await db.update(subscriptions).set({ ...values, currentPeriodStart: status === 'active' && sub.status !== 'active' ? now : sub.currentPeriodStart }).where(eq(subscriptions.id, sub.id));
    else await db.insert(subscriptions).values({ ...values, tenantId, currentPeriodStart: status === 'active' ? now : null });
    await audit({ tenantId, userId: s.user.id, action: 'admin.subscription_updated', entityType: 'subscription', entityId: sub?.id, summary: `تحديث الاشتراك من إدارة المنصة: ${consoleAr.status[status]} · ${consoleAr.cycle[billingCycle]}`, metadata: { ...values, trialEndsAt: values.trialEndsAt?.toISOString(), currentPeriodEnd: values.currentPeriodEnd?.toISOString(), updatedAt: undefined } });
    refresh(tenantId);
    return { ok: true, message: t.console.tenants.subSaved };
  });
}

export async function toggleSuspend(tenantId: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireSuperAdmin();
    const { t } = await getI18n();
    const tenant = await tenantOr404(tenantId);
    if (!tenant) return { ok: false, error: t.common.error };
    await db.update(tenants).set({ suspendedAt: tenant.suspendedAt ? null : new Date(), updatedAt: new Date() }).where(eq(tenants.id, tenantId));
    await audit({ tenantId, userId: s.user.id, action: tenant.suspendedAt ? 'admin.unsuspended' : 'admin.suspended', entityType: 'tenant', entityId: tenantId, summary: tenant.suspendedAt ? 'إلغاء إيقاف الشركة' : 'إيقاف الشركة' });
    refresh(tenantId);
    return { ok: true, message: tenant.suspendedAt ? t.console.tenants.unsuspended : t.console.tenants.suspended };
  });
}

export async function updateTenant(tenantId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireSuperAdmin();
    const { t } = await getI18n();
    const name = str(form, 'name');
    const crNumber = str(form, 'crNumber');
    if (name.length < 2 || (crNumber && !/^\d{10}$/.test(crNumber))) return { ok: false, error: t.common.error };
    await db.update(tenants).set({ name, crNumber: crNumber || null, updatedAt: new Date() }).where(eq(tenants.id, tenantId));
    await audit({ tenantId, userId: s.user.id, action: 'admin.tenant_updated', entityType: 'tenant', entityId: tenantId, summary: `تعديل بيانات الشركة: ${name}` });
    refresh(tenantId);
    return { ok: true, message: t.common.saved };
  });
}

export async function deleteTenant(tenantId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const s = await requireSuperAdmin();
    const { t } = await getI18n();
    const tenant = await tenantOr404(tenantId);
    if (!tenant) return { ok: false, error: t.common.error };
    if (str(form, 'confirm') !== tenant.name) return { ok: false, error: t.console.tenants.deleteMismatch };
    const files = await db.select({ key: documents.fileKey }).from(documents).where(and(eq(documents.tenantId, tenantId), isNotNull(documents.fileKey)));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    for (const file of files) if (file.key) await storage().remove(file.key).catch(() => undefined);
    await audit({ tenantId: null, userId: s.user.id, action: 'admin.tenant_deleted', entityType: 'tenant', entityId: tenantId, summary: `حذف الشركة «${tenant.name}» نهائياً`, metadata: { name: tenant.name, crNumber: tenant.crNumber } });
    revalidatePath('/admin', 'layout');
    return { ok: true, message: t.console.tenants.deleted };
  });
  if (result.ok) redirect('/admin/tenants');
  return result;
}

/** Support access: the admin works inside the company's workspace as themselves, with owner rights. */
export async function enterWorkspace(tenantId: string): Promise<void> {
  const s = await requireSuperAdmin();
  const tenant = await tenantOr404(tenantId);
  if (!tenant) redirect('/admin/tenants');
  await setActiveTenant(tenantId);
  await audit({ tenantId, userId: s.user.id, action: 'admin.support_entered', entityType: 'tenant', entityId: tenantId, summary: `دخول مسؤول المنصة ${s.user.name} إلى مساحة العمل (وضع الدعم)` });
  redirect('/app');
}

export async function addTenantNote(tenantId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireSuperAdmin();
    const { t } = await getI18n();
    const body = str(form, 'body').slice(0, 4000);
    if (!body) return { ok: false, error: t.common.required };
    await db.insert(tenantNotes).values({ tenantId, authorId: s.user.id, body });
    refresh(tenantId);
    return { ok: true, message: t.common.saved };
  });
}

export async function deleteTenantNote(noteId: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireSuperAdmin();
    const { t } = await getI18n();
    const [note] = await db.delete(tenantNotes).where(eq(tenantNotes.id, noteId)).returning({ tenantId: tenantNotes.tenantId });
    refresh(note?.tenantId);
    return { ok: true, message: t.common.saved };
  });
}

async function ownersOf(tenantId: string, exceptMembershipId?: string) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(memberships)
    .where(and(eq(memberships.tenantId, tenantId), eq(memberships.role, 'owner'), exceptMembershipId ? ne(memberships.id, exceptMembershipId) : undefined));
  return n;
}

export async function addMember(tenantId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireSuperAdmin();
    const { t } = await getI18n();
    const email = str(form, 'email').toLowerCase();
    const name = str(form, 'name');
    const role = str(form, 'role') as Role;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !ROLES.includes(role)) return { ok: false, error: t.common.error };
    let [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      const password = str(form, 'password');
      const problem = passwordProblem(password);
      if (problem) return { ok: false, error: t.auth[problem as 'password_too_short' | 'password_too_weak'] };
      if (name.length < 2) return { ok: false, error: t.common.required };
      [user] = await db.insert(users).values({ email, name, passwordHash: await hashPassword(password) }).returning();
    }
    const [existing] = await db.select({ id: memberships.id }).from(memberships).where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, user.id)));
    if (existing) return { ok: false, error: t.console.tenants.memberExists };
    await db.insert(memberships).values({ tenantId, userId: user.id, role });
    await audit({ tenantId, userId: s.user.id, action: 'admin.member_added', entityType: 'user', entityId: user.id, summary: `إضافة ${user.email} بدور ${t.roles[role]} من إدارة المنصة` });
    refresh(tenantId);
    return { ok: true, message: t.console.tenants.memberAdded };
  });
}

export async function changeMemberRole(membershipId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireSuperAdmin();
    const { t } = await getI18n();
    const role = str(form, 'role') as Role;
    const [m] = await db.select().from(memberships).where(eq(memberships.id, membershipId));
    if (!m || !ROLES.includes(role)) return { ok: false, error: t.common.error };
    if (m.role === 'owner' && role !== 'owner' && (await ownersOf(m.tenantId, m.id)) === 0) return { ok: false, error: t.console.tenants.lastOwner };
    await db.update(memberships).set({ role }).where(eq(memberships.id, membershipId));
    await audit({ tenantId: m.tenantId, userId: s.user.id, action: 'admin.member_role', entityType: 'user', entityId: m.userId, summary: `تغيير الدور إلى ${t.roles[role]} من إدارة المنصة` });
    refresh(m.tenantId);
    return { ok: true, message: t.console.tenants.roleChanged };
  });
}

export async function removeMember(membershipId: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireSuperAdmin();
    const { t } = await getI18n();
    const [m] = await db.select().from(memberships).where(eq(memberships.id, membershipId));
    if (!m) return { ok: false, error: t.common.error };
    if (m.role === 'owner' && (await ownersOf(m.tenantId, m.id)) === 0) return { ok: false, error: t.console.tenants.lastOwner };
    await db.delete(memberships).where(eq(memberships.id, membershipId));
    await db.update(sessions).set({ tenantId: null }).where(and(eq(sessions.userId, m.userId), eq(sessions.tenantId, m.tenantId)));
    await audit({ tenantId: m.tenantId, userId: s.user.id, action: 'admin.member_removed', entityType: 'user', entityId: m.userId, summary: 'إزالة مستخدم من الشركة من إدارة المنصة' });
    refresh(m.tenantId);
    return { ok: true, message: t.console.tenants.memberRemoved };
  });
}

import { redirect } from 'next/navigation';
import { ApiError } from '@/lib/http';
import { isStaff, staffCan, type StaffPermission } from './roles';
import { getSession, type SessionContext } from './session';

export type CraftsmanContext = SessionContext & { craftsman: NonNullable<SessionContext['craftsman']> };

// ── Pages ────────────────────────────────────────────────

export async function requireUserPage(next = '/app'): Promise<SessionContext> {
  const s = await getSession();
  if (!s) redirect(`/login?next=${encodeURIComponent(next)}`);
  return s;
}

export async function requireCraftsmanPage(next = '/app'): Promise<CraftsmanContext> {
  const s = await requireUserPage(next);
  if (!s.craftsman) redirect(isStaff(s.user.role) ? '/admin' : '/app/onboarding');
  return s as CraftsmanContext;
}

export async function requireStaffPage(permission: StaffPermission = 'console:view'): Promise<SessionContext> {
  const s = await requireUserPage('/admin');
  if (!isStaff(s.user.role)) redirect('/app');
  if (!staffCan(s.user.role, permission)) redirect('/admin?denied=1');
  return s;
}

// ── API & actions ────────────────────────────────────────

export async function apiUser(): Promise<SessionContext> {
  const s = await getSession();
  if (!s) throw new ApiError('unauthenticated');
  if (s.user.suspended) throw new ApiError('account_suspended');
  return s;
}

export async function apiCraftsman(): Promise<CraftsmanContext> {
  const s = await apiUser();
  if (!s.craftsman) throw new ApiError('not_onboarded', 403);
  return s as CraftsmanContext;
}

export async function apiStaff(permission: StaffPermission): Promise<SessionContext> {
  const s = await apiUser();
  if (!staffCan(s.user.role, permission)) throw new ApiError('forbidden');
  return s;
}

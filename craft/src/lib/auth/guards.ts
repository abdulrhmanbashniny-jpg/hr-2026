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

/** Every portal page first sends a user holding a temporary password to choose their own. */
export const PASSWORD_PAGE = '/account/password';

export async function requirePortalPage(next: string): Promise<SessionContext> {
  const s = await requireUserPage(next);
  if (s.user.mustChangePassword) redirect(`${PASSWORD_PAGE}?next=${encodeURIComponent(next)}`);
  return s;
}

export async function requireCraftsmanPage(next = '/app'): Promise<CraftsmanContext> {
  const s = await requirePortalPage(next);
  if (!s.craftsman) redirect(isStaff(s.user.role) ? '/admin' : '/app/onboarding');
  return s as CraftsmanContext;
}

export async function requireStaffPage(permission: StaffPermission = 'console:view'): Promise<SessionContext> {
  const s = await requirePortalPage('/admin');
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

/** Like apiUser, for everything except changing the password itself. */
export async function apiPortalUser(): Promise<SessionContext> {
  const s = await apiUser();
  if (s.user.mustChangePassword) throw new ApiError('password_change_required');
  return s;
}

export async function apiCraftsman(): Promise<CraftsmanContext> {
  const s = await apiPortalUser();
  if (!s.craftsman) throw new ApiError('not_onboarded', 403);
  return s as CraftsmanContext;
}

export async function apiStaff(permission: StaffPermission): Promise<SessionContext> {
  const s = await apiPortalUser();
  if (!staffCan(s.user.role, permission)) throw new ApiError('forbidden');
  return s;
}

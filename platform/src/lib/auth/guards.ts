import { redirect } from 'next/navigation';
import { staffCan, type StaffPermission } from '@/lib/admin/staff';
import { can, type Permission, type Role } from './rbac';
import { getSession, type SessionContext } from './session';

export type TenantContext = SessionContext & { tenant: NonNullable<SessionContext['tenant']>; role: Role };

export class ForbiddenError extends Error {
  constructor(public readonly reason: 'forbidden' | 'read_only' | 'suspended' = 'forbidden') {
    super(reason);
  }
}

export async function requireUser(): Promise<SessionContext> {
  const s = await getSession();
  if (!s) redirect('/login');
  return s;
}

/** For pages: signed-in user with an active company workspace. */
export async function requireTenant(): Promise<TenantContext> {
  const s = await requireUser();
  if (!s.tenant || !s.role) redirect(s.user.isSuperAdmin ? '/admin' : '/register?step=company');
  return s as TenantContext;
}

/**
 * For mutations: checks the permission and that the workspace can still write (trial or paid
 * subscription active, company not suspended). Platform staff in support mode are not blocked by
 * billing or suspension, since they are there to fix it; their own memberships follow the rules.
 */
export async function requirePermission(permission: Permission, opts: { allowReadOnly?: boolean } = {}): Promise<TenantContext> {
  const s = await requireTenant();
  if (!can(s.role, permission)) throw new ForbiddenError('forbidden');
  if (s.tenant.suspended && !s.supportMode) throw new ForbiddenError('suspended');
  if (!opts.allowReadOnly && !s.supportMode && s.subscription && !s.subscription.canWrite) throw new ForbiddenError('read_only');
  return s;
}

/** For console pages: any platform team member, or one whose role grants `permission`. */
export async function requireSuperAdmin(permission?: StaffPermission): Promise<SessionContext> {
  const s = await requireUser();
  if (!s.user.isSuperAdmin) redirect('/app');
  if (permission && !staffCan(s.user.staffRole, permission)) redirect('/admin?denied=1');
  return s;
}

/** For console mutations: the team member's role must grant `permission`. */
export async function requireStaff(permission: StaffPermission): Promise<SessionContext> {
  const s = await requireUser();
  if (!s.user.isSuperAdmin || !staffCan(s.user.staffRole, permission)) throw new ForbiddenError('forbidden');
  return s;
}

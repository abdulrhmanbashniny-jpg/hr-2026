/**
 * Platform team (the people who run Mutabaa itself). Every team member is a user with
 * `isSuperAdmin = true`; `staffRole` narrows what they can do in the console.
 */
export const STAFF_ROLES = ['owner', 'admin', 'support', 'finance'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export type StaffPermission =
  | 'tenants:view'
  | 'tenants:notes'
  | 'tenants:enter'
  | 'tenants:manage'
  | 'tenants:delete'
  | 'billing:manage'
  | 'users:view'
  | 'users:support'
  | 'users:manage'
  | 'messages:send'
  | 'audit:view'
  | 'inbox:view'
  | 'system:manage'
  | 'team:manage';

const ALL: StaffPermission[] = [
  'tenants:view',
  'tenants:notes',
  'tenants:enter',
  'tenants:manage',
  'tenants:delete',
  'billing:manage',
  'users:view',
  'users:support',
  'users:manage',
  'messages:send',
  'audit:view',
  'inbox:view',
  'system:manage',
  'team:manage',
];

const GRANTS: Record<StaffRole, StaffPermission[]> = {
  owner: ALL,
  admin: ALL.filter((p) => p !== 'team:manage' && p !== 'tenants:delete'),
  support: ['tenants:view', 'tenants:notes', 'tenants:enter', 'users:view', 'users:support', 'messages:send', 'audit:view', 'inbox:view'],
  finance: ['tenants:view', 'tenants:notes', 'billing:manage', 'audit:view'],
};

export function isStaffRole(v: unknown): v is StaffRole {
  return typeof v === 'string' && (STAFF_ROLES as readonly string[]).includes(v);
}

/** A platform admin from before roles existed has every permission. */
export function staffRoleOf(user: { isSuperAdmin: boolean; staffRole?: string | null }): StaffRole | null {
  if (!user.isSuperAdmin) return null;
  return isStaffRole(user.staffRole) ? user.staffRole : 'owner';
}

export function staffCan(role: StaffRole | null | undefined, permission: StaffPermission): boolean {
  return !!role && GRANTS[role].includes(permission);
}

export function staffPermissions(role: StaffRole | null | undefined): StaffPermission[] {
  return role ? GRANTS[role] : [];
}

/** A plain object the client can use to hide controls the role cannot use. */
export function staffAbilities(role: StaffRole | null | undefined): Record<StaffPermission, boolean> {
  return Object.fromEntries(ALL.map((p) => [p, staffCan(role, p)])) as Record<StaffPermission, boolean>;
}

export const STAFF_PERMISSIONS = ALL;

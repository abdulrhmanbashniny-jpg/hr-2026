export type UserRole = 'craftsman' | 'reviewer' | 'admin' | 'super_admin';

export type StaffPermission =
  | 'console:view'
  | 'invoices:review'
  | 'craftsmen:view'
  | 'craftsmen:manage'
  | 'points:adjust'
  | 'fraud:view'
  | 'fraud:manage'
  | 'incentives:manage'
  | 'rewards:manage'
  | 'redemptions:fulfill'
  | 'dealers:manage'
  | 'reports:export'
  | 'settings:manage'
  | 'reviews:moderate'
  | 'products:manage';

const REVIEWER: StaffPermission[] = ['console:view', 'invoices:review', 'craftsmen:view', 'fraud:view', 'redemptions:fulfill', 'reviews:moderate'];
const ADMIN: StaffPermission[] = [
  ...REVIEWER,
  'craftsmen:manage',
  'points:adjust',
  'fraud:manage',
  'incentives:manage',
  'rewards:manage',
  'dealers:manage',
  'reports:export',
  'products:manage',
];

const GRANTS: Record<UserRole, ReadonlySet<StaffPermission>> = {
  craftsman: new Set(),
  reviewer: new Set(REVIEWER),
  admin: new Set(ADMIN),
  super_admin: new Set<StaffPermission>([...ADMIN, 'settings:manage']),
};

export function isStaff(role: UserRole): boolean {
  return role !== 'craftsman';
}

export function staffCan(role: UserRole, permission: StaffPermission): boolean {
  return GRANTS[role].has(permission);
}

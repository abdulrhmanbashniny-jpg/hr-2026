export type Role = 'owner' | 'general_manager' | 'hr_officer' | 'fleet_officer' | 'viewer';
export const ROLES: Role[] = ['owner', 'general_manager', 'hr_officer', 'fleet_officer', 'viewer'];

export type Permission =
  | 'people:write'
  | 'fleet:write'
  | 'imports:people'
  | 'imports:fleet'
  | 'documents:write'
  | 'documents:share'
  | 'alerts:manage'
  | 'contacts:manage'
  | 'settings:manage'
  | 'members:manage'
  | 'billing:manage'
  | 'audit:read';

const MATRIX: Record<Role, Permission[]> = {
  owner: [
    'people:write', 'fleet:write', 'imports:people', 'imports:fleet', 'documents:write', 'documents:share',
    'alerts:manage', 'contacts:manage', 'settings:manage', 'members:manage', 'billing:manage', 'audit:read',
  ],
  general_manager: [
    'people:write', 'fleet:write', 'imports:people', 'imports:fleet', 'documents:write', 'documents:share',
    'alerts:manage', 'contacts:manage', 'settings:manage', 'members:manage', 'audit:read',
  ],
  hr_officer: ['people:write', 'imports:people', 'documents:write', 'documents:share', 'alerts:manage'],
  fleet_officer: ['fleet:write', 'imports:fleet', 'documents:write', 'documents:share', 'alerts:manage'],
  viewer: [],
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return !!role && MATRIX[role].includes(permission);
}

export function permissionsOf(role: Role): Permission[] {
  return MATRIX[role];
}

export const TEMPLATE_PERMISSION = {
  residents: 'imports:people',
  gosi: 'imports:people',
  driver_cards: 'imports:people',
  vehicles: 'imports:fleet',
  operating_cards: 'imports:fleet',
} as const satisfies Record<string, Permission>;

/** Which alert modules a role is responsible for (notifications fan-out). */
export function modulesForRole(role: Role): string[] {
  switch (role) {
    case 'hr_officer':
      return ['residents', 'gosi', 'driver_cards', 'documents', 'cross'];
    case 'fleet_officer':
      return ['fleet', 'operating_cards', 'driver_cards', 'documents', 'cross'];
    default:
      return ['residents', 'gosi', 'fleet', 'operating_cards', 'driver_cards', 'documents', 'cross'];
  }
}

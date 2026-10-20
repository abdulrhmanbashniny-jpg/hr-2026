import { describe, expect, it } from 'vitest';
import { STAFF_PERMISSIONS, staffAbilities, staffCan, staffRoleOf } from '@/lib/admin/staff';

describe('platform team roles', () => {
  it('treats a platform admin from before roles existed as owner', () => {
    expect(staffRoleOf({ isSuperAdmin: true, staffRole: null })).toBe('owner');
    expect(staffRoleOf({ isSuperAdmin: true, staffRole: 'support' })).toBe('support');
    expect(staffRoleOf({ isSuperAdmin: false, staffRole: 'owner' })).toBeNull();
    expect(staffRoleOf({ isSuperAdmin: true, staffRole: 'nonsense' })).toBe('owner');
  });

  it('gives the owner everything and keeps the team with the owner', () => {
    for (const p of STAFF_PERMISSIONS) expect(staffCan('owner', p)).toBe(true);
    expect(staffCan('admin', 'team:manage')).toBe(false);
    expect(staffCan('admin', 'tenants:delete')).toBe(false);
    expect(staffCan('admin', 'billing:manage')).toBe(true);
  });

  it('limits support and finance to their own work', () => {
    expect(staffCan('support', 'tenants:enter')).toBe(true);
    expect(staffCan('support', 'users:support')).toBe(true);
    expect(staffCan('support', 'users:manage')).toBe(false);
    expect(staffCan('support', 'billing:manage')).toBe(false);
    expect(staffCan('finance', 'billing:manage')).toBe(true);
    expect(staffCan('finance', 'tenants:enter')).toBe(false);
    expect(staffCan('finance', 'messages:send')).toBe(false);
    expect(staffCan(null, 'tenants:view')).toBe(false);
  });

  it('exposes a complete ability map for the client', () => {
    const can = staffAbilities('support');
    expect(Object.keys(can).sort()).toEqual([...STAFF_PERMISSIONS].sort());
    expect(can['system:manage']).toBe(false);
  });
});

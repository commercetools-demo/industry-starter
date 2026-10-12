import { describe, expect, it } from 'vitest';
import { ACTIONS, can, INSUFFICIENT, logicalRoles, ROLE, type LogicalRole, type PortalAction } from './permissions';

const perms = (roles: LogicalRole[]) => ({ roles, ctPermissions: [] });

// Role matrix of plans/workstreams/R-*.md section 5 (Admin, Buyer).
const MATRIX: Record<PortalAction, { admin: boolean; buyer: boolean }> = {
  'dashboard.view': { admin: true, buyer: true },
  'catalog.view': { admin: true, buyer: true },
  'catalog.edit': { admin: true, buyer: false },
  'price.edit': { admin: true, buyer: false },
  'discount.edit': { admin: true, buyer: false },
  'bundles.manage': { admin: true, buyer: false },
  'import.run': { admin: true, buyer: false },
  'store.view': { admin: true, buyer: false },
  'store.view-performance': { admin: true, buyer: false },
  'store.edit': { admin: true, buyer: false },
  'content.view': { admin: true, buyer: false },
  'content.edit': { admin: true, buyer: false },
  'marketing.manage': { admin: true, buyer: false },
  'email.manage': { admin: true, buyer: false },
  'customers.view': { admin: true, buyer: false },
  'customers.manage': { admin: true, buyer: false },
  'subscriptions.view': { admin: true, buyer: false },
  'subscriptions.manage': { admin: true, buyer: false },
  'returns.view': { admin: true, buyer: true },
  'returns.process': { admin: true, buyer: false },
  'reviews.view': { admin: true, buyer: true },
  'reviews.moderate': { admin: true, buyer: false },
  'partnership.view': { admin: true, buyer: false },
  'company.view': { admin: true, buyer: true },
  'company.edit': { admin: true, buyer: false },
  'account.view': { admin: true, buyer: true },
  'account.edit': { admin: true, buyer: true },
  'customer-session.start': { admin: true, buyer: false },
};

describe('permissions', () => {
  it('role matrix table: can(action) for admin, buyer', () => {
    expect([...ACTIONS].sort()).toEqual(Object.keys(MATRIX).sort());
    for (const action of ACTIONS) {
      expect(can(perms(['admin']), action), `admin ${action}`).toBe(MATRIX[action].admin);
      expect(can(perms(['buyer']), action), `buyer ${action}`).toBe(MATRIX[action].buyer);
      expect(can(perms([]), action), `no role ${action}`).toBe(false);
    }
  });

  it('role keys map to logical roles and unknown keys map to none', () => {
    expect(ROLE).toEqual({ admin: 'mau-role-admin', buyer: 'mau-role-buyer' });
    expect(logicalRoles(['mau-role-admin'])).toEqual(['admin']);
    expect(logicalRoles(['mau-role-buyer', 'mau-role-admin'])).toEqual(['admin', 'buyer']);
    expect(logicalRoles(['approver', 'something-else'])).toEqual([]);
  });

  it('insufficient permissions text is the specified sentence', () => {
    expect(INSUFFICIENT).toBe('Insufficient permissions to perform this task');
  });
});

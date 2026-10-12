// Portal permission model (workstream R-01). Two logical roles only, Admin and Buyer (owner Q-V01, D-028).
// Seller-side writes go through the admin client after `authorizeStore`, so most actions map to roles only;
// S, T, U, V, W add rows to ACTION_ROLES as they need them. No approval actions exist.

import { ROLE, logicalRoles } from '@/lib/roles';
import type { LogicalRole } from '@/lib/types';

// Associate role keys of the seed (`seed/src/data/org.ts` ROLE_KEYS), defined once in G's `lib/roles.ts`; other keys
// (for example `approver`) map to no role.
export { ROLE, logicalRoles };
export type { LogicalRole };

export interface PortalPermissions {
  roles: LogicalRole[];
  ctPermissions: string[];
}

/** Text shown for a disabled action and returned for a 403. */
export const INSUFFICIENT = 'Insufficient permissions to perform this task';

const ALL: readonly LogicalRole[] = ['admin', 'buyer'];
const ADMIN: readonly LogicalRole[] = ['admin'];

/** The one table: every action and the logical roles that may perform it. */
export const ACTION_ROLES = {
  'dashboard.view': ALL,
  'catalog.view': ALL,
  'catalog.edit': ADMIN,
  'price.edit': ADMIN,
  'discount.edit': ADMIN,
  'bundles.manage': ADMIN,
  'import.run': ADMIN,
  'store.view': ADMIN,
  'store.view-performance': ADMIN,
  'store.edit': ADMIN,
  'content.view': ADMIN,
  'content.edit': ADMIN,
  'marketing.manage': ADMIN,
  'email.manage': ADMIN,
  'customers.view': ADMIN,
  'customers.manage': ADMIN,
  'subscriptions.view': ADMIN,
  'subscriptions.manage': ADMIN,
  'returns.view': ALL,
  'returns.process': ADMIN,
  'reviews.view': ALL,
  'reviews.moderate': ADMIN,
  'partnership.view': ADMIN,
  'company.view': ALL,
  'company.edit': ADMIN,
  'account.view': ALL,
  'account.edit': ALL,
  'customer-session.start': ADMIN,
} as const satisfies Record<string, readonly LogicalRole[]>;

export type PortalAction = keyof typeof ACTION_ROLES;
export const ACTIONS = Object.keys(ACTION_ROLES) as PortalAction[];

/** Roles allowed to perform an action. */
export function rolesFor(action: PortalAction): LogicalRole[] {
  return [...ACTION_ROLES[action]];
}

export function can(p: PortalPermissions, action: PortalAction): boolean {
  const allowed: readonly LogicalRole[] = ACTION_ROLES[action];
  return p.roles.some((role) => allowed.includes(role));
}

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import 'server-only';
import type { BusinessUnit } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { logicalRoles } from '@/lib/roles';
import { createTtlCache } from '@/lib/ttl-cache';
import type { AssociateRoles, Session } from '@/lib/types';

/**
 * Every signed-in buying operation (carts, orders, quotes, lists, company) goes through this chain, never through
 * project-level `apiRoot.carts()` and friends. commercetools enforces membership and permissions.
 */
export function asAssociate(session: Pick<Session, 'customerId' | 'businessUnitKey'>) {
  if (!session.customerId || !session.businessUnitKey) throw new Error('asAssociate needs customerId and businessUnitKey in the session');
  return apiRoot
    .asAssociate()
    .withAssociateIdValue({ associateId: session.customerId })
    .inBusinessUnitKeyWithBusinessUnitKeyValue({ businessUnitKey: session.businessUnitKey });
}

const MAX_DEPTH = 10;

/**
 * Role keys of `customerId` in the unit: its own assignments, plus assignments with `inheritance: Enabled` from each
 * ancestor, walking up while the child's `associateMode` is `ExplicitAndFromParent`.
 */
export async function roleKeysInUnit(customerId: string, businessUnitKey: string): Promise<string[]> {
  const keys = new Set<string>();
  let unitKey: string | undefined = businessUnitKey;
  let own = true;
  for (let depth = 0; unitKey && depth < MAX_DEPTH; depth += 1) {
    const { body }: { body: BusinessUnit } = await apiRoot.businessUnits().withKey({ key: unitKey }).get().execute();
    const associate = body.associates.find((a) => a.customer.id === customerId);
    for (const assignment of associate?.associateRoleAssignments ?? []) {
      const roleKey = assignment.associateRole.key;
      if (roleKey && (own || assignment.inheritance === 'Enabled')) keys.add(roleKey);
    }
    own = false;
    unitKey = body.associateMode === 'ExplicitAndFromParent' ? body.parentUnit?.key : undefined;
  }
  return [...keys].sort();
}

// Role definitions are configuration, not per-user data: a short shared cache is safe.
const rolePermissions = createTtlCache<string[]>({ ttlMs: 60_000, negativeTtlMs: 10_000 });

async function permissionsOf(roleKey: string): Promise<string[]> {
  const hit = rolePermissions.get(roleKey);
  if (hit) return hit;
  const { body } = await apiRoot.associateRoles().withKey({ key: roleKey }).get().execute();
  rolePermissions.set(roleKey, body.permissions);
  return body.permissions;
}

export const clearRoleCache = (): void => rolePermissions.clear();

/** The signed-in associate's roles in the active unit: role keys, logical roles (Admin, Buyer) and commercetools permission strings. */
export async function getAssociateRoles(session: Pick<Session, 'customerId' | 'businessUnitKey'>): Promise<AssociateRoles> {
  if (!session.customerId || !session.businessUnitKey) return { roleKeys: [], roles: [], ctPermissions: [] };
  const roleKeys = await roleKeysInUnit(session.customerId, session.businessUnitKey);
  const permissions = await Promise.all(roleKeys.map(permissionsOf));
  return { roleKeys, roles: logicalRoles(roleKeys), ctPermissions: [...new Set(permissions.flat())].sort() };
}

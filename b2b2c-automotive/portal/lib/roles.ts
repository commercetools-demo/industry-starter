// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The two portal roles (D-028). Keys match the seed (`seed/src/data/org.ts` ROLE_KEYS). No server-only: the UI may import it.
import type { LogicalRole } from '@/lib/types';

export const ROLE = { admin: 'mau-role-admin', buyer: 'mau-role-buyer' } as const;
export const ROLE_ADMIN = ROLE.admin;
export const ROLE_BUYER = ROLE.buyer;

/** Logical roles for a list of associate role keys (unknown keys are ignored); Admin first, no duplicates. */
export function logicalRoles(roleKeys: readonly string[]): LogicalRole[] {
  const out: LogicalRole[] = [];
  for (const logical of ['admin', 'buyer'] as const) {
    if (roleKeys.includes(ROLE[logical])) out.push(logical);
  }
  return out;
}

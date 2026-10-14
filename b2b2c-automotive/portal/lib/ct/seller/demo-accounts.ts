/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import 'server-only';
import { adminRoot } from '@/lib/ct/admin-client';
import { ROLE } from '@/lib/roles';
import type { DemoAccount } from '@/lib/portal/types';

export interface DemoAssociate extends DemoAccount {
  email: string;
}

const ROLE_LABEL: Record<string, { text: string; rank: number }> = {
  [ROLE.admin]: { text: 'Admin', rank: 0 },
  [ROLE.buyer]: { text: 'Buyer', rank: 1 },
};

/**
 * Seeded demo associates (R-17a): customers with `custom.fields.isDemo = true`, joined to the business units that list them.
 * Label "Name · Role · Business unit", ordered by business unit then Admin before Buyer. Server only: the email is used to
 * sign in and is never returned to the browser by the routes (they strip everything but id, label and group).
 */
export async function listDemoAssociates(): Promise<DemoAssociate[]> {
  const customers = await adminRoot.customers().get({ queryArgs: { where: 'custom(fields(isDemo=true))', limit: 100 } }).execute();
  const byId = new Map(customers.body.results.map((c) => [c.id, c]));
  if (byId.size === 0) return [];
  const ids = [...byId.keys()].map((id) => `"${id}"`).join(',');
  const units = await adminRoot.businessUnits().get({ queryArgs: { where: `associates(customer(id in (${ids})))`, limit: 100, sort: 'name asc' } }).execute();
  const rows: Array<DemoAssociate & { rank: number }> = [];
  for (const unit of units.body.results) {
    for (const associate of unit.associates) {
      const customer = byId.get(associate.customer.id);
      if (!customer) continue;
      const roleKey = associate.associateRoleAssignments.map((a) => a.associateRole.key ?? '').find((k) => k in ROLE_LABEL);
      if (!roleKey) continue;
      const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.email;
      rows.push({
        id: customer.id,
        email: customer.email,
        label: `${name} · ${ROLE_LABEL[roleKey].text} · ${unit.name}`,
        group: unit.name,
        rank: ROLE_LABEL[roleKey].rank,
      });
    }
  }
  return rows.sort((a, b) => a.group.localeCompare(b.group) || a.rank - b.rank).map(({ rank: _rank, ...row }) => (void _rank, row));
}

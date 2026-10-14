// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import 'server-only';
import type { BusinessUnit } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { getStoreChannelData } from '@/lib/ct/stores';
import type { BusinessContext, BusinessUnitView, UnitStatus } from '@/lib/types';

/** commercetools ids are UUIDs; anything else never reaches a query predicate. */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const STATUSES: readonly UnitStatus[] = ['Active', 'Inactive', 'Pending'];

/** One unit as the app sees it, for `customerId`'s associate entry. Stores are the unit's own, or the inherited ones for `FromParent`. */
export function mapBusinessUnit(unit: BusinessUnit, customerId: string): BusinessUnitView {
  const storeMode = unit.storeMode === 'FromParent' ? 'FromParent' : 'Explicit';
  const stores = storeMode === 'FromParent' ? unit.inheritedStores : unit.stores;
  const mine = unit.associates.find((a) => a.customer.id === customerId);
  return {
    key: unit.key,
    name: unit.name,
    unitType: unit.unitType === 'Division' ? 'Division' : 'Company',
    status: STATUSES.includes(unit.status as UnitStatus) ? (unit.status as UnitStatus) : 'Inactive',
    parentKey: unit.parentUnit?.key,
    storeMode,
    storeKeys: (stores ?? []).map((s) => s.key),
    roleKeys: (mine?.associateRoleAssignments ?? []).map((r) => r.associateRole.key ?? '').filter(Boolean),
  };
}

/**
 * Every business unit that lists the customer as an associate (direct entries), ordered by key.
 * Project-level read by the frontend client (scope `view_business_units`): the as-associate chain needs a unit first.
 */
export async function listAssociateUnits(customerId: string): Promise<BusinessUnitView[]> {
  if (!ID_PATTERN.test(customerId)) throw new Error('Invalid customer id');
  const { body } = await apiRoot
    .businessUnits()
    .get({ queryArgs: { where: `associates(customer(id="${customerId}"))`, sort: 'key asc', limit: 100 } })
    .execute();
  return body.results.map((u) => mapBusinessUnit(u, customerId));
}

/** Registered resellers wait for a Malva operator only when `PORTAL_REQUIRE_APPROVAL=true`; by default the unit status is not checked. */
export const approvalRequired = (): boolean => process.env.PORTAL_REQUIRE_APPROVAL === 'true';

const hasStore = (u: BusinessUnitView) => (!approvalRequired() || u.status === 'Active') && u.storeKeys.length > 0;

/** First active unit with a store, preferring `preferredKey` (the last used unit) when it qualifies; `undefined` when none. */
export function pickDefaultUnit(units: BusinessUnitView[], preferredKey?: string): BusinessUnitView | undefined {
  return units.find((u) => u.key === preferredKey && hasStore(u)) ?? units.find(hasStore);
}

/**
 * The five session fields for a unit the customer belongs to. The store is `storeKey` when the unit has it,
 * otherwise the unit's first store. Throws `Unit not available` for a unit the customer is not an associate of,
 * an inactive unit, or a unit without a store; nothing is written anywhere.
 */
export async function resolveBusinessContext(input: {
  customerId: string;
  businessUnitKey: string;
  storeKey?: string;
  accountGroupIds: string[];
}): Promise<BusinessContext> {
  const unit = (await listAssociateUnits(input.customerId)).find((u) => u.key === input.businessUnitKey);
  if (!unit || !hasStore(unit)) throw new Error('Unit not available');
  return contextFor(unit, input.storeKey, input.accountGroupIds);
}

async function contextFor(unit: BusinessUnitView, storeKey: string | undefined, accountGroupIds: string[]): Promise<BusinessContext> {
  const chosen = storeKey && unit.storeKeys.includes(storeKey) ? storeKey : unit.storeKeys[0];
  const store = await getStoreChannelData(chosen);
  return { ...store, businessUnitKey: unit.key, accountGroupIds };
}

export type SignInOutcome =
  | { kind: 'ready'; context: BusinessContext; unit: BusinessUnitView }
  /** The customer has units, none of them Active: a freshly registered reseller awaiting Malva's approval. */
  | { kind: 'pending' }
  /** No unit, or only units without a store. */
  | { kind: 'none' };

/** What a login leads to: the context of the first usable unit, a pending state, or nothing. */
export async function resolveSignInContext(input: { customerId: string; accountGroupIds: string[]; lastUnitKey?: string }): Promise<SignInOutcome> {
  const units = await listAssociateUnits(input.customerId);
  const unit = pickDefaultUnit(units, input.lastUnitKey);
  if (unit) {
    const context = await contextFor(unit, undefined, input.accountGroupIds);
    return { kind: 'ready', context, unit };
  }
  if (approvalRequired() && units.length > 0 && units.every((u) => u.status !== 'Active')) return { kind: 'pending' };
  return { kind: 'none' };
}

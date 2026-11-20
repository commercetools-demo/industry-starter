import { COLLECT_METHOD_KEY } from '@/lib/cart/plan';
import type { CartLine, GroupKey, Store } from '@/lib/types';
import { marketForCountry } from '@/lib/utils';

/**
 * Pure fulfilment plans for checkout (workstream K, 3.5). No commercetools types: `lib/ct/checkout.ts` turns the plans into
 * update actions and carts.
 *
 * A payment group is what one cart can pay in the hosted flow: one per collect store, then `delivery` (delivery and
 * subscribe lines both ship to the shopper's address, so they share a group and a delivery method). The cart page shows
 * three clusters; checkout may pay fewer groups than clusters.
 */
export interface FulfilmentGroup {
  key: GroupKey;
  kind: 'collect' | 'delivery';
  storeKey: string | null;
  lineIds: string[];
}

type PlanCartLine = Pick<CartLine, 'id' | 'fulfilment' | 'groupKey' | 'store'>;

/** Does this country offer collection (US only, D-035)? */
export function collectionOffered(country: string): boolean {
  return marketForCountry(country)?.collection === true;
}

/**
 * Payment groups in payment order: collect stores (first appearance), then delivery. Collect lines of a market without
 * collection are left out (they raise `collect_not_available` and block checkout).
 */
export function planGroups(cart: { country: string; lines: readonly PlanCartLine[] }): FulfilmentGroup[] {
  const collect = new Map<GroupKey, FulfilmentGroup>();
  const delivery: FulfilmentGroup = { key: 'delivery', kind: 'delivery', storeKey: null, lineIds: [] };
  const allowCollect = collectionOffered(cart.country);
  for (const l of cart.lines) {
    if (l.fulfilment === 'collect') {
      if (!allowCollect) continue;
      const g = collect.get(l.groupKey) ?? { key: l.groupKey, kind: 'collect' as const, storeKey: l.store?.key ?? null, lineIds: [] };
      g.lineIds.push(l.id);
      collect.set(l.groupKey, g);
    } else delivery.lineIds.push(l.id);
  }
  return [...collect.values(), ...(delivery.lineIds.length ? [delivery] : [])];
}

/** All the lines that need a pickup name. */
export function hasCollect(groups: readonly FulfilmentGroup[]): boolean {
  return groups.some((g) => g.kind === 'collect');
}

/** One cart per group under `complete-per-group`. Codes are copied to the first cart only (Q-K-02c). */
export interface SplitPart {
  part: number;
  group: FulfilmentGroup;
  applyCodes: boolean;
}

export function splitPlan(groups: readonly FulfilmentGroup[]): SplitPart[] {
  return groups.map((group, part) => ({ part, group, applyCodes: part === 0 }));
}

/** A group key as a commercetools address or shipping key (`[A-Za-z0-9_-]`): `collect:mcf-store-x` becomes `collect-mcf-store-x`. */
export function shippingKeyOf(key: GroupKey): string {
  return key.replace(/[^A-Za-z0-9_-]/g, '-');
}

/** Every store is in New York City (D-035), so the state of a collect address is a market constant, not data. */
const STORE_STATE: Record<string, string> = { US: 'NY' };

export interface CollectAddress {
  firstName: string;
  lastName: string;
  company: string;
  streetName: string;
  city: string;
  postalCode: string;
  country: string;
  state?: string;
  additionalAddressInfo: string;
  email?: string;
  key?: string;
}

/** Splits "Maya Lopez" into first and last name; a single word becomes the last name. */
export function splitPickupName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: '', lastName: parts[0] ?? '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] ?? '' };
}

/** The store as a shipping address carrying the pickup name (collect group address, 3.5). */
export function collectAddress(store: Pick<Store, 'name' | 'addressLine' | 'city' | 'postalCode' | 'country'>, pickupName: string, email?: string): CollectAddress {
  const state = STORE_STATE[store.country];
  return {
    ...splitPickupName(pickupName),
    company: 'Malva Coffee',
    streetName: store.addressLine,
    city: store.city,
    postalCode: store.postalCode,
    country: store.country,
    ...(state ? { state } : {}),
    additionalAddressInfo: `Collection at ${store.name}`,
    ...(email ? { email } : {}),
  };
}

// ---------------------------------------------------------------- the update actions (plain objects, shaped like SDK actions)

export type FulfilmentAction =
  | { action: 'setLineItemShippingDetails'; lineItemId: string; shippingDetails?: { targets: { addressKey: string; quantity: number; shippingMethodKey?: string }[] } }
  | { action: 'removeShippingMethod'; shippingKey: string }
  | { action: 'removeItemShippingAddress'; addressKey: string }
  | { action: 'addItemShippingAddress'; address: CollectAddress & { key: string } }
  | { action: 'addShippingMethod'; shippingKey: string; shippingMethod: { typeId: 'shipping-method'; key: string }; shippingAddress: CollectAddress & { key: string } }
  | { action: 'setShippingAddress'; address: CollectAddress }
  | { action: 'setShippingMethod'; shippingMethod: { typeId: 'shipping-method'; key: string } };

/** What the plan reads from a cart that may already carry shipping entries (a retry, or an earlier attempt). */
export interface ExistingShipping {
  shippingKeys: readonly string[];
  addressKeys: readonly string[];
  /** Line ids whose `shippingDetails` is set. */
  linesWithDetails: readonly string[];
}

export interface CollectLineAllocation { lineId: string; quantity: number }

export interface MultipleInput {
  existing: ExistingShipping;
  /** The collect groups with the store address already built (pickup name inside). */
  collect: { group: FulfilmentGroup; address: CollectAddress; lines: CollectLineAllocation[] }[];
}

/**
 * `complete-multiple`: the actions for a `shippingMode: Multiple` cart, in an order that keeps every reference valid:
 * clear the allocations, remove the shipping entries, remove the addresses, add the collect addresses, add the collect
 * methods, allocate the collect lines. The ship lines are left for the hosted flow (probes S13 and S14).
 */
export function buildFulfilmentActions(input: MultipleInput): FulfilmentAction[] {
  const actions: FulfilmentAction[] = [];
  for (const lineItemId of input.existing.linesWithDetails) actions.push({ action: 'setLineItemShippingDetails', lineItemId });
  for (const shippingKey of input.existing.shippingKeys) actions.push({ action: 'removeShippingMethod', shippingKey });
  for (const addressKey of input.existing.addressKeys) actions.push({ action: 'removeItemShippingAddress', addressKey });
  for (const c of input.collect) actions.push({ action: 'addItemShippingAddress', address: { ...c.address, key: shippingKeyOf(c.group.key) } });
  for (const c of input.collect) {
    const key = shippingKeyOf(c.group.key);
    actions.push({
      action: 'addShippingMethod',
      shippingKey: key,
      shippingMethod: { typeId: 'shipping-method', key: COLLECT_METHOD_KEY },
      shippingAddress: { ...c.address, key },
    });
  }
  for (const c of input.collect) {
    for (const l of c.lines) {
      actions.push({
        action: 'setLineItemShippingDetails',
        lineItemId: l.lineId,
        shippingDetails: { targets: [{ addressKey: shippingKeyOf(c.group.key), quantity: l.quantity, shippingMethodKey: shippingKeyOf(c.group.key) }] },
      });
    }
  }
  return actions;
}

/**
 * A cart that holds one group. Collect only: the store is the shipping address and the method is `mcf-collect`. Delivery
 * only: nothing is pre-set (the hosted flow asks the address and lists the delivery method).
 */
export function buildSingleGroupActions(group: FulfilmentGroup, address: CollectAddress | null): FulfilmentAction[] {
  if (group.kind !== 'collect' || !address) return [];
  return [
    { action: 'setShippingAddress', address },
    { action: 'setShippingMethod', shippingMethod: { typeId: 'shipping-method', key: COLLECT_METHOD_KEY } },
  ];
}

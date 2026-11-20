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

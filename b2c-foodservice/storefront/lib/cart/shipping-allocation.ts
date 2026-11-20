import { COLLECT_METHOD_KEY, SHIP_METHOD_KEY } from '@/lib/cart/plan';
import { collectAddress, shippingKeyOf } from '@/lib/checkout/fulfilment-plan';
import type { Fulfilment, Store } from '@/lib/types';

/**
 * Shipping allocation of a `Multiple` cart (D-062). Pure: no commercetools types, `lib/ct/cart.ts` (`syncShipping`) reads the
 * cart into `AllocationInput` and posts the actions.
 *
 * A `Multiple` cart only prices shipping and only taxes the lines when every unit is allocated to a shipping entry (verified live:
 * probe F-K-02). So after every write each fulfilment group gets one entry, and every line a target for its whole quantity:
 *  - one `collect-<storeKey>` entry per store a collect line belongs to (method `mcf-collect`, the store's address);
 *  - one `delivery` entry for delivery and subscribe lines together (method `mcf-ship-standard`, an address with only the
 *    country until the hosted Checkout writes the real one).
 * The address key and the shipping key are the same string, as the documentation recommends.
 *
 * Only keys this module owns (`delivery`, `collect-*`) are ever removed. A line whose targets point anywhere else is left alone,
 * so what the hosted Checkout writes onto the cart is never undone by a re-render.
 */
export interface AllocationLine {
  id: string;
  quantity: number;
  fulfilment: Fulfilment;
  /** The store the line is collected at (collect lines only). */
  storeKey?: string;
}

export interface ShipAddress {
  key: string;
  country: string;
  state?: string;
  city?: string;
  postalCode?: string;
  streetName?: string;
  company?: string;
  additionalAddressInfo?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface ExistingEntry {
  shippingKey: string;
  /** The key of the shipping method, when the cart was read with the method expanded. */
  methodKey?: string;
  address?: Partial<ShipAddress>;
}

export interface ExistingTarget { addressKey: string; quantity: number; shippingMethodKey?: string }

export interface AllocationInput {
  country: string;
  lines: readonly AllocationLine[];
  /** The cart's `shipping[]`. */
  entries: readonly ExistingEntry[];
  /** The cart's `itemShippingAddresses`. */
  addresses: readonly Partial<ShipAddress>[];
  /** Line id to its current `shippingDetails.targets` (absent: none). */
  targets: Readonly<Record<string, readonly ExistingTarget[] | undefined>>;
  /** Every store of the market, to build a collect address from a store key. */
  stores: readonly Pick<Store, 'key' | 'name' | 'addressLine' | 'city' | 'postalCode' | 'country'>[];
  /** Set at checkout: the pickup name and email go into every collect address. */
  pickup?: { name: string; email?: string };
}

type Target = { addressKey: string; quantity: number; shippingMethodKey: string };

export type AllocationAction =
  | { action: 'setLineItemShippingDetails'; lineItemId: string; shippingDetails?: { targets: Target[] } }
  | { action: 'removeShippingMethod'; shippingKey: string }
  | { action: 'removeItemShippingAddress'; addressKey: string }
  | { action: 'addItemShippingAddress'; address: ShipAddress }
  | { action: 'addShippingMethod'; shippingKey: string; shippingMethod: { typeId: 'shipping-method'; key: string }; shippingAddress: ShipAddress };

export const DELIVERY_SHIPPING_KEY = 'delivery';

/** A key this module wrote (and may remove). */
export const isOwnedKey = (key: string): boolean => key === DELIVERY_SHIPPING_KEY || key.startsWith('collect-');

/** The fields an address of ours is compared by (what we write). */
const ADDRESS_FIELDS = ['country', 'state', 'city', 'postalCode', 'streetName', 'company', 'additionalAddressInfo', 'firstName', 'lastName', 'email'] as const;

const sameAddress = (a: Partial<ShipAddress>, b: Partial<ShipAddress>): boolean => ADDRESS_FIELDS.every((f) => (a[f] ?? '') === (b[f] ?? ''));

interface WantedGroup { key: string; methodKey: string; address: ShipAddress; keepExistingAddress: boolean; lineIds: string[] }

/** A collect address: the store, plus the pickup name and email once the shopper gave them (names left out before that). */
function storeAddress(store: AllocationInput['stores'][number], key: string, pickup: AllocationInput['pickup']): ShipAddress {
  if (pickup) return { ...collectAddress(store, pickup.name, pickup.email), key };
  const { firstName: _f, lastName: _l, email: _e, ...base } = collectAddress(store, '');
  void _f; void _l; void _e;
  return { ...base, key };
}

/** The groups the cart should have, in a stable order: collect stores by first appearance, then delivery. */
function wantedGroups(input: AllocationInput): WantedGroup[] {
  const groups = new Map<string, WantedGroup>();
  const delivery: WantedGroup = {
    key: DELIVERY_SHIPPING_KEY, methodKey: SHIP_METHOD_KEY, address: { key: DELIVERY_SHIPPING_KEY, country: input.country }, keepExistingAddress: true, lineIds: [],
  };
  for (const line of input.lines) {
    const store = line.fulfilment === 'collect' ? input.stores.find((s) => s.key === line.storeKey) : undefined;
    if (!store) {
      // Delivery, subscribe, and a collect line whose store is unknown (checkout refuses those; the cart must still price).
      delivery.lineIds.push(line.id);
      continue;
    }
    const key = shippingKeyOf(`collect:${store.key}`);
    const g = groups.get(key) ?? { key, methodKey: COLLECT_METHOD_KEY, address: storeAddress(store, key, input.pickup), keepExistingAddress: false, lineIds: [] };
    g.lineIds.push(line.id);
    groups.set(key, g);
  }
  return [...groups.values(), ...(delivery.lineIds.length > 0 ? [delivery] : [])];
}

const sameTargets = (current: readonly ExistingTarget[], want: Target): boolean =>
  current.length === 1 && current[0]?.addressKey === want.addressKey && current[0].quantity === want.quantity && current[0].shippingMethodKey === want.shippingMethodKey;

/** The update actions that make the cart fully allocated, in an order that keeps every reference valid. Empty when it already is. */
export function planAllocation(input: AllocationInput): AllocationAction[] {
  const wanted = wantedGroups(input);
  const wantedByKey = new Map(wanted.map((g) => [g.key, g]));
  const lineById = new Map(input.lines.map((l) => [l.id, l]));
  const wantedTarget = new Map<string, Target>();
  for (const g of wanted) {
    for (const id of g.lineIds) {
      const line = lineById.get(id);
      if (line) wantedTarget.set(id, { addressKey: g.key, quantity: line.quantity, shippingMethodKey: g.key });
    }
  }

  // A delivery address the hosted Checkout filled in stays; only a bare one is ours to write.
  const existingEntry = (key: string) => input.entries.find((e) => e.shippingKey === key);
  const existingAddress = (key: string) => input.addresses.find((a) => a.key === key);
  for (const g of wanted) {
    if (!g.keepExistingAddress) continue;
    const have = existingEntry(g.key)?.address ?? existingAddress(g.key);
    if (have && ADDRESS_FIELDS.some((f) => f !== 'country' && have[f])) g.address = { ...g.address, ...Object.fromEntries(ADDRESS_FIELDS.flatMap((f) => (have[f] ? [[f, have[f]]] : []))) } as ShipAddress;
  }

  // Entries and addresses of ours that are wrong: not wanted any more, another method, or another address.
  const staleEntries = input.entries.filter((e) => {
    if (!isOwnedKey(e.shippingKey)) return false;
    const w = wantedByKey.get(e.shippingKey);
    return !w || (e.methodKey !== undefined && e.methodKey !== w.methodKey) || !sameAddress(e.address ?? {}, w.address);
  });
  const staleEntryKeys = new Set(staleEntries.map((e) => e.shippingKey));
  const staleAddresses = input.addresses.filter((a) => {
    if (!a.key || !isOwnedKey(a.key)) return false;
    const w = wantedByKey.get(a.key);
    return !w || !sameAddress(a, w.address) || staleEntryKeys.has(a.key);
  });
  const staleAddressKeys = new Set(staleAddresses.map((a) => a.key));
  const removedKeys = new Set([...staleEntryKeys, ...staleAddressKeys]);

  // Lines to clear first (a reference to something removed), and lines to give a target afterwards.
  const actions: AllocationAction[] = [];
  const retarget: string[] = [];
  for (const line of input.lines) {
    const current = input.targets[line.id] ?? [];
    if (current.some((t) => !isOwnedKey(t.addressKey))) continue; // written by the hosted Checkout: not ours to change
    const want = wantedTarget.get(line.id);
    const ok = want !== undefined && sameTargets(current, want) && !current.some((t) => removedKeys.has(t.addressKey));
    if (ok) continue;
    retarget.push(line.id);
    // Only a line that points at something about to be removed is cleared first; a new quantity just replaces the targets.
    if (current.some((t) => removedKeys.has(t.addressKey))) actions.push({ action: 'setLineItemShippingDetails', lineItemId: line.id });
  }

  for (const e of staleEntries) actions.push({ action: 'removeShippingMethod', shippingKey: e.shippingKey });
  for (const a of staleAddresses) if (a.key) actions.push({ action: 'removeItemShippingAddress', addressKey: a.key });

  const haveAddress = (key: string) => input.addresses.some((a) => a.key === key) && !staleAddressKeys.has(key);
  const haveEntry = (key: string) => input.entries.some((e) => e.shippingKey === key) && !staleEntryKeys.has(key);
  for (const g of wanted) if (!haveAddress(g.key)) actions.push({ action: 'addItemShippingAddress', address: g.address });
  for (const g of wanted) {
    if (haveEntry(g.key)) continue;
    actions.push({ action: 'addShippingMethod', shippingKey: g.key, shippingMethod: { typeId: 'shipping-method', key: g.methodKey }, shippingAddress: g.address });
  }
  for (const id of retarget) {
    const want = wantedTarget.get(id);
    if (want) actions.push({ action: 'setLineItemShippingDetails', lineItemId: id, shippingDetails: { targets: [want] } });
  }
  return actions;
}

/** True when every line's targets add up to its quantity and name an entry the cart has. `valid` alone is not enough (verified live). */
export function isFullyAllocated(
  lines: readonly Pick<AllocationLine, 'id' | 'quantity'>[],
  targets: Readonly<Record<string, readonly ExistingTarget[] | undefined>>,
  entryKeys: readonly string[],
): boolean {
  return lines.every((l) => {
    const t = targets[l.id] ?? [];
    return t.length > 0 && t.reduce((n, x) => n + x.quantity, 0) === l.quantity && t.every((x) => x.shippingMethodKey !== undefined && entryKeys.includes(x.shippingMethodKey));
  });
}

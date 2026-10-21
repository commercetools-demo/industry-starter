import type { CartGroup, CartLine, CartLineStore, Fulfilment, GroupKey } from '@/lib/types';

/**
 * Pure cart plans (workstream I). No commercetools types here: the server maps its lines to `PlanLine` and turns the
 * plan into update actions.
 *
 * CONTRACT FOR K (checkout) AND OTHERS, mixed bags (D-033)
 *  - A bag may hold collect, delivery and subscribe lines at once. Every `CartLine` carries `fulfilment`, `groupKey` and,
 *    for collect lines, its `store`. `groupKeyOf(line)` is the ONLY definition of a fulfilment group: `collect:<storeKey>`
 *    (one group per store), `delivery`, `subscribe`. K assigns shipping methods per `GroupKey`.
 *  - `Cart.groups` is in display order: collect stores (first appearance), then delivery, then subscribe. A group with no
 *    lines does not exist.
 *  - `CART_SHIPPING_MODE` (lib/shop-config.ts) is a constant: `Single` prices the whole bag with one shipping method
 *    (`syncShippingMethod`: standard when any line is delivery or subscribe, else collect); `Multiple` is decided by K
 *    (spike K-01): `mapCart` then sums `shipping[].shippingInfo.price` and `syncShippingMethod` does nothing.
 *  - The shipping mode is fixed when a cart is created. Changing it means a new cart: `rebuildCart` (lib/ct/cart.ts)
 *    carries lines and codes over; `getCartView` calls it when an active cart's mode differs from the constant.
 *  - Canada has no collection (D-035): a session in that market cannot create or switch to a collect line.
 */

/** A cart line as the plans see it. `channelId` is the supply channel (a store) and is absent on delivery lines. */
export interface PlanLine {
  id: string;
  sku: string;
  quantity: number;
  fulfilment: Fulfilment;
  channelId?: string;
  subscribe: boolean;
}

export type SwitchTarget = { fulfilment: 'delivery' } | { fulfilment: 'collect'; channelId: string };

/** One step of a plan. `set`: change the supply channel and the fulfilment field. `merge`: add to a twin and remove the line. */
export type PlanOp =
  | { kind: 'set'; lineId: string; fulfilment: 'delivery' | 'collect'; channelId: string | null }
  | { kind: 'merge'; keepId: string; quantity: number; removeId: string };

export type SwitchPlan =
  | { kind: 'noop' }
  | { kind: 'reject'; reason: 'line_not_found' | 'subscribe_line_not_switchable' }
  | { kind: 'ops'; ops: PlanOp[]; /** Quantity the line ends with (merged quantity when it joins a twin). */ resultingQuantity: number };

/** Seeded shipping method keys (D-034: standard carrier only; collection has its own zero-price method). */
export const SHIP_METHOD_KEY = 'mcf-ship-standard';
export const COLLECT_METHOD_KEY = 'mcf-collect';

/**
 * The shipping method of a `Single` cart (Q-I-04): standard when any line ships (delivery or subscribe), else collect.
 * An empty bag has none.
 */
export function shippingMethodKeyFor(fulfilments: readonly Fulfilment[]): typeof SHIP_METHOD_KEY | typeof COLLECT_METHOD_KEY | null {
  if (fulfilments.length === 0) return null;
  return fulfilments.some((f) => f !== 'collect') ? SHIP_METHOD_KEY : COLLECT_METHOD_KEY;
}

/** The fulfilment group a line belongs to. */
export function groupKeyOf(line: { fulfilment: Fulfilment; store?: Pick<CartLineStore, 'key'> }): GroupKey {
  if (line.fulfilment === 'collect') return `collect:${line.store?.key ?? 'unknown'}`;
  return line.fulfilment;
}

/** Groups in display order: collect stores (order of first appearance), then delivery, then subscribe. Empty groups are omitted. */
export function groupLines(lines: ReadonlyArray<Pick<CartLine, 'id' | 'fulfilment' | 'groupKey' | 'store'>>): CartGroup[] {
  const collect = new Map<GroupKey, CartGroup>();
  const delivery: CartGroup = { key: 'delivery', kind: 'delivery', lineIds: [] };
  const subscribe: CartGroup = { key: 'subscribe', kind: 'subscribe', lineIds: [] };
  for (const l of lines) {
    if (l.fulfilment === 'delivery') delivery.lineIds.push(l.id);
    else if (l.fulfilment === 'subscribe') subscribe.lineIds.push(l.id);
    else {
      const group = collect.get(l.groupKey) ?? { key: l.groupKey, kind: 'collect' as const, ...(l.store ? { store: l.store } : {}), lineIds: [] };
      group.lineIds.push(l.id);
      collect.set(l.groupKey, group);
    }
  }
  return [...collect.values(), ...(delivery.lineIds.length ? [delivery] : []), ...(subscribe.lineIds.length ? [subscribe] : [])];
}

/** Another one-time line with the same SKU, fulfilment and supply channel (null for delivery). Subscribe lines never merge. */
function findTwin(lines: readonly PlanLine[], self: PlanLine, fulfilment: 'delivery' | 'collect', channelId: string | null): PlanLine | undefined {
  return lines.find(
    (l) =>
      l.id !== self.id && !l.subscribe && l.sku === self.sku && l.fulfilment === fulfilment && (l.channelId ?? null) === channelId,
  );
}

/**
 * Switch one line between delivery and collect. A twin (same SKU, target fulfilment, target channel) absorbs the line
 * in one atomic update: its quantity grows and the line is removed. Without a twin the line changes in place.
 * Subscribe lines are never switched. A line already in the target state is a no-op.
 */
export function planFulfilmentSwitch(lines: readonly PlanLine[], lineId: string, target: SwitchTarget): SwitchPlan {
  const line = lines.find((l) => l.id === lineId);
  if (!line) return { kind: 'reject', reason: 'line_not_found' };
  if (line.subscribe || line.fulfilment === 'subscribe') return { kind: 'reject', reason: 'subscribe_line_not_switchable' };
  const channelId = target.fulfilment === 'collect' ? target.channelId : null;
  if (line.fulfilment === target.fulfilment && (line.channelId ?? null) === channelId) return { kind: 'noop' };
  const twin = findTwin(lines, line, target.fulfilment, channelId);
  if (twin) {
    const quantity = twin.quantity + line.quantity;
    return { kind: 'ops', ops: [{ kind: 'merge', keepId: twin.id, quantity, removeId: line.id }], resultingQuantity: quantity };
  }
  return { kind: 'ops', ops: [{ kind: 'set', lineId: line.id, fulfilment: target.fulfilment, channelId }], resultingQuantity: line.quantity };
}

/**
 * Move every collect line to another store. Lines that meet a twin at the new store merge into it (also two moved lines of
 * the same SKU). Returns no ops when nothing has to move.
 */
export function planStoreChange(lines: readonly PlanLine[], channelId: string): PlanOp[] {
  const state = lines.map((l) => ({ ...l }));
  const ops: PlanOp[] = [];
  for (const line of state) {
    if (line.fulfilment !== 'collect' || line.subscribe || line.channelId === channelId) continue;
    const twin = findTwin(state.filter((l) => l !== line), line, 'collect', channelId);
    if (twin) {
      twin.quantity += line.quantity;
      ops.push({ kind: 'merge', keepId: twin.id, quantity: twin.quantity, removeId: line.id });
      line.quantity = 0; // gone; later lines must not pick it as a twin
      line.id = `${line.id}:removed`;
      line.sku = '';
    } else {
      ops.push({ kind: 'set', lineId: line.id, fulfilment: 'collect', channelId });
      line.channelId = channelId;
    }
  }
  return ops;
}

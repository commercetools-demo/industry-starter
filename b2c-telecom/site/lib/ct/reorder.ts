import 'server-only';
import type { Cart as CtCart, CartUpdateAction, LineItem } from '@commercetools/platform-sdk';
import { ACTIVATION_FEE_SLUG_PREFIX } from '@/lib/config/cart';
import type { Order, OrderLine, ReorderUnavailable } from '@/lib/types';

// "Buy again": what to change on the cart that Replicate Cart made from an order. Replicate copies the lines of the order (with their
// recurrence info and custom fields) and its custom fields, but keeps nothing a buyer must not inherit and drops nothing visibly:
//  - `parentLineItemId` still holds the ORDER's line ids and must point at the new lines,
//  - the order's own custom fields (stored schedule, label snapshot, cancellation ...) must not travel onto a new cart,
//  - a line whose product is no longer available may be missing (compare by SKU, never trust a flag), or may have lost its recurrence.
// The report is the SKU comparison; unavailable lines are removed from the new cart and listed, never dropped silently.

/** Order custom fields that describe THAT order and must be cleared on the new cart. */
export const ORDER_ONLY_FIELDS = ['serviceStartDate', 'priceSchedule', 'labelSnapshot', 'cancellation', 'returnRequest', 'demoMarker'] as const;

const parentOf = (line: LineItem): string | undefined => {
  const value = (line.custom?.fields as Record<string, unknown> | undefined)?.parentLineItemId;
  return typeof value === 'string' && value !== '' ? value : undefined;
};

export interface ReorderPlan {
  actions: CartUpdateAction[];
  unavailable: ReorderUnavailable[];
}

export function planReorder(order: Order, cart: CtCart): ReorderPlan {
  const free = [...cart.lineItems];
  const actions: CartUpdateAction[] = [];
  const unavailable: ReorderUnavailable[] = [];
  const replica = new Map<string, LineItem>(); // order line id -> line of the new cart
  const dropped = new Map<string, OrderLine>(); // order line id -> the order line that could not be reused

  const fieldNames = Object.keys((cart.custom?.fields as Record<string, unknown> | undefined) ?? {});
  for (const name of ORDER_ONLY_FIELDS) if (fieldNames.includes(name)) actions.push({ action: 'setCustomField', name });

  const drop = (line: OrderLine, reason: ReorderUnavailable['reason']): void => {
    dropped.set(line.id, line);
    unavailable.push({ sku: line.sku, name: line.name, reason });
  };

  for (const line of order.lines) {
    const index = free.findIndex((candidate) => candidate.variant.sku === line.sku);
    if (index < 0) {
      drop(line, 'not-available');
      continue;
    }
    const match = free.splice(index, 1)[0] as LineItem;
    if (line.recurring && match.recurrenceInfo === undefined) {
      actions.push({ action: 'removeLineItem', lineItemId: match.id });
      drop(line, 'recurrence-lost');
      continue;
    }
    replica.set(line.id, match);
  }

  // Add-ons and equipment of a line that could not be reused are removed too (they would belong to nothing).
  for (let changed = true; changed; ) {
    changed = false;
    for (const line of order.lines) {
      if (dropped.has(line.id) || line.parentLineId === null || !dropped.has(line.parentLineId)) continue;
      const match = replica.get(line.id);
      if (match) actions.push({ action: 'removeLineItem', lineItemId: match.id });
      replica.delete(line.id);
      drop(line, 'not-available');
      changed = true;
    }
  }

  for (const line of order.lines) {
    const match = replica.get(line.id);
    if (!match || line.parentLineId === null) continue;
    const parent = replica.get(line.parentLineId);
    if (parent && parentOf(match) !== parent.id) actions.push({ action: 'setLineItemCustomField', lineItemId: match.id, name: 'parentLineItemId', value: parent.id });
  }

  // The activation fee of a plan that could not be reused goes with it.
  for (const line of dropped.values()) {
    for (const fee of cart.customLineItems) {
      if (fee.slug === `${ACTIVATION_FEE_SLUG_PREFIX}${line.offerKey}`) actions.push({ action: 'removeCustomLineItem', customLineItemId: fee.id });
    }
  }

  return { actions, unavailable };
}

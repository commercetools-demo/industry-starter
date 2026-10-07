import type { HeldService, Offer } from '@/lib/types';

// Pure: derives the services a customer holds from already-read orders and recurring orders (D-021). The reads are in lib/ct/holdings.ts.

export interface HoldingOrder {
  orderNumber: string;
  /** commercetools `orderState` (Open, Confirmed, Complete, Cancelled). */
  orderState: string;
  offerKeys: string[];
}
export interface HoldingRecurringOrder {
  id: string;
  /** commercetools `recurringOrderState` (Active, Paused, Canceled, Expired, ...). */
  state: string;
  offerKeys: string[];
}

const HOLDING_RECURRING_STATES: readonly string[] = ['Active', 'Paused'];

/**
 * A held service is a base package or bundle on an order that is not cancelled, or on an Active or Paused recurring order.
 * Add-ons, equipment and devices do not hold a service for conflict purposes. Offer keys missing from the catalog are
 * ignored; duplicates collapse to one entry per offer key, preferring the recurring order; output sorted by offer key.
 */
export function deriveHoldings(orders: HoldingOrder[], recurring: HoldingRecurringOrder[], offersByKey: Record<string, Offer>): HeldService[] {
  const held = new Map<string, HeldService>();
  const consider = (offerKey: string, source: HeldService['source'], reference: string) => {
    const offer = offersByKey[offerKey];
    if (!offer || (offer.kind !== 'base-package' && offer.kind !== 'bundle')) return;
    const existing = held.get(offerKey);
    if (existing && (existing.source === 'recurring-order' || source === 'order')) return;
    held.set(offerKey, { offerKey, offerName: offer.name, source, reference });
  };
  for (const order of orders) {
    if (order.orderState === 'Cancelled') continue;
    for (const key of order.offerKeys) consider(key, 'order', order.orderNumber);
  }
  for (const recurringOrder of recurring) {
    if (!HOLDING_RECURRING_STATES.includes(recurringOrder.state)) continue;
    for (const key of recurringOrder.offerKeys) consider(key, 'recurring-order', recurringOrder.id);
  }
  return [...held.values()].sort((a, b) => (a.offerKey < b.offerKey ? -1 : a.offerKey > b.offerKey ? 1 : 0));
}

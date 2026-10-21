import { buildSummary, checkoutIssues, codeSavings, type SavingsCart } from '@/lib/checkout/summary';
import { collectionOffered } from '@/lib/checkout/fulfilment-plan';
import { todayHours } from '@/lib/hours';
import type { Cart, CheckoutPayment, CheckoutPickup, CheckoutState, MixedStrategy, Store } from '@/lib/types';

export interface CheckoutStateInput {
  cart: Cart;
  /** The raw cart's discount code and discount data (structural, see `SavingsCart`). */
  savings: SavingsCart;
  stores: readonly Store[];
  now: Date;
  locale: string;
  strategy: MixedStrategy;
  /** Delivery-time text of the standard method in the session locale, or null. */
  deliveryDays: string | null;
  payments?: CheckoutPayment[] | null;
}

/** "9:00 to 17:00" style window for today, or null when the store is closed today. */
export function hoursLabel(window: { open: string; close: string } | null): string | null {
  return window ? `${window.open}–${window.close}` : null;
}

/** The collect card: the first collect group's store (a bag normally holds one). null in a market without collection. */
export function mapPickup(cart: Cart, stores: readonly Store[], now: Date): CheckoutPickup | null {
  if (!collectionOffered(cart.country)) return null;
  const group = cart.groups.find((g) => g.kind === 'collect');
  if (!group?.store) return null;
  const store = stores.find((s) => s.key === group.store?.key);
  return {
    storeKey: group.store.key,
    storeName: group.store.name,
    address: [group.store.addressLine, group.store.city].filter(Boolean).join(', '),
    hoursToday: store ? hoursLabel(todayHours(store, now, store.timeZone)) : null,
    phone: store?.phone ?? null,
    readyMinutes: group.store.collectionMinutes,
    pickupName: null,
  };
}

/** Everything the Review stage needs, from one cart read. Pure. */
export function mapCheckoutState(i: CheckoutStateInput): CheckoutState {
  const issues = checkoutIssues(i.cart);
  const hasShipLine = i.cart.lines.some((l) => l.fulfilment !== 'collect');
  return {
    cartId: i.cart.id,
    version: i.cart.version,
    strategy: i.strategy,
    cart: i.cart,
    pickup: mapPickup(i.cart, i.stores, i.now),
    deliveryNote: hasShipLine ? { freeAboveCents: i.cart.freeShipping.threshold?.centAmount ?? null, days: i.deliveryDays } : null,
    codes: codeSavings(i.savings, i.locale),
    summary: buildSummary(i.cart),
    issues,
    payments: i.payments ?? null,
  };
}

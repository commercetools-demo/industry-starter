import { buildSummary, checkoutIssues } from '@/lib/checkout/summary';
import type { Cart, CheckoutPickup, CheckoutState, OrderView } from '@/lib/types';
import { STORE_SOHO } from '@/test/cart';

/** Test data for checkout (workstream K): a checkout state around a view-shaped cart. */
export const PICKUP: CheckoutPickup = {
  storeKey: STORE_SOHO.key, storeName: STORE_SOHO.name, address: '1 Prince St, New York', hoursToday: '08:00–18:00', phone: '+1 212 555 0101',
  readyMinutes: 15, pickupName: null,
};

export function checkoutState(cart: Cart, over: Partial<CheckoutState> = {}): CheckoutState {
  const hasCollect = cart.country === 'US' && cart.lines.some((l) => l.fulfilment === 'collect');
  const hasShip = cart.lines.some((l) => l.fulfilment !== 'collect');
  return {
    cartId: cart.id, version: cart.version, strategy: 'complete-per-group', cart,
    pickup: hasCollect ? PICKUP : null,
    deliveryNote: hasShip ? { freeAboveCents: cart.currency === 'CAD' ? 9900 : 7500, days: '2-4 business days' } : null,
    codes: [], summary: buildSummary(cart), issues: checkoutIssues(cart), payments: null, ...over,
  };
}

export function orderView(over: Partial<OrderView> = {}): OrderView {
  return {
    id: 'ord-1', orderNumber: 'MC-ABCDEFGHJK', createdAt: '2026-10-21T10:00:00.000Z', email: 'maya@example.com', locale: 'en-US', currency: 'USD',
    customerId: null, state: 'ordered', paymentState: 'Paid', shipmentState: null,
    status: 'ordered', hasCollect: false, hasShip: true,
    lines: [{ id: 'l1', sku: 'SKU-1', name: 'Dark Roast Pods', variantSummary: 'Intensity 8 · 10 capsules', quantity: 2, imageUrl: null, fulfilment: 'delivery', storeKey: null, storeName: null, recurrence: null, unitCents: 1200, priceCents: 2400 }],
    collect: [], ship: { methodName: 'Standard', estimate: '2-4 business days', address: '1 Main St · Brooklyn · 11201', recipient: null }, deliveries: [], subscriptions: [],
    totals: { subtotalCents: 2400, discountCents: 0, shippingCents: 695, taxCents: 276, totalCents: 3371 }, linked: [], returns: [], canReturn: false, returnWindowEndsAt: null, returnable: {}, ...over,
  };
}

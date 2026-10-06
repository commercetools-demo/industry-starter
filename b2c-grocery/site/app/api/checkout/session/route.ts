import { NextResponse } from 'next/server';
import { cartSlotId, getSessionCart, jsonError } from '@/lib/cart-api';
import { SLOT_CONFIG } from '@/lib/config/slots';
import { getAvailableQuantity } from '@/lib/ct/availability';
import { clearSlot, ensureShippingMethod, ShippingMethodUnavailableError } from '@/lib/ct/cart-delivery';
import { createCheckoutSession } from '@/lib/ct/checkout-session';
import { getSlotService } from '@/lib/slots';
import { getSlotDays } from '@/lib/slots/days';
import { isDeliverable } from '@/lib/slots/deliverable';

const noStore = (res: NextResponse): NextResponse => {
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
};
const fail = (error: string, status: number, extra: Record<string, unknown> = {}) => noStore(jsonError(error, status, extra));

/**
 * Starts the hosted checkout for the session cart. Checks run in this order and no session is created when one fails:
 * `NO_CART` (400), `EMPTY_CART` (400), `UNAVAILABLE_LINES` (409 + `lines`), `NO_ADDRESS` (422), `NO_SLOT` (422),
 * `SLOT_FULL` (409 + fresh `days`; the slot is cleared from the cart). The slot is held again for 15 minutes right
 * before the session is created (D-042). Success: `{ sessionId, projectKey, region }`.
 */
export async function POST() {
  try {
    const cart = await getSessionCart();
    if (!cart) return fail('NO_CART', 400);
    if (cart.lineItems.length === 0) return fail('EMPTY_CART', 400);

    const available = await Promise.all(cart.lineItems.map((l) => (l.variant.sku ? getAvailableQuantity(l.variant.sku) : Promise.resolve(0))));
    const short = cart.lineItems.filter((l, i) => available[i] < l.quantity).map((l) => l.id);
    if (short.length > 0) return fail('UNAVAILABLE_LINES', 409, { lines: short });

    const address = cart.shippingAddress;
    if (!address?.postalCode || !isDeliverable(address.country, address.postalCode)) return fail('NO_ADDRESS', 422);
    const slotId = cartSlotId(cart);
    if (!slotId) return fail('NO_SLOT', 422);

    try {
      await ensureShippingMethod(cart.id);
    } catch (e) {
      if (e instanceof ShippingMethodUnavailableError) return fail('SHIPPING_UNAVAILABLE', 422);
      throw e;
    }

    const hold = await getSlotService().holdSlot(slotId, cart.id, SLOT_CONFIG.holdMinutes);
    if (!hold.ok) {
      await clearSlot(cart.id);
      const fresh = await getSlotDays({ shippingAddress: address });
      return fail('SLOT_FULL', 409, fresh.ok ? { days: fresh.days, ...(fresh.nextAvailableDate ? { nextAvailableDate: fresh.nextAvailableDate } : {}) } : {});
    }

    return noStore(NextResponse.json(await createCheckoutSession(cart.id)));
  } catch (e) {
    console.error('Checkout session request failed', e instanceof Error ? e.message : e);
    return fail('CHECKOUT_ERROR', 500);
  }
}

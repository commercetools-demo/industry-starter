import { ApiError, handle } from '@/lib/api';
import { checkoutContext } from '@/lib/checkout-route';
import { PaymentUnavailableError } from '@/lib/checkout/payment-provider';
import { getPaymentProvider } from '@/lib/checkout/provider';
import { readPaymentCart } from '@/lib/ct/checkout';
import { placeOrder } from '@/lib/ct/orders';
import { NO_STORE } from '@/lib/rx-route';
import { clearCart } from '@/lib/session';
import type { PlaceOrderFailure } from '@/lib/types';

/** Safe, specific sentences per outcome; the page has its own copy and uses the `code`. */
const MESSAGES: Record<PlaceOrderFailure, string> = {
  EMPTY_CART: 'Your cart is empty.',
  ADDRESS_MISSING: 'Save your delivery address first.',
  NO_DELIVERY_METHOD: 'No delivery option is available for this address.',
  LINES_UNAVAILABLE: 'An item in your cart can no longer be filled.',
  TOTALS_MOVED: 'The total changed after your payment was authorized. Please review it and pay again.',
  PAYMENT_REQUIRED: 'Authorize your payment before placing the order.',
  PAYMENT_DECLINED: 'Your payment was declined.',
  DISPENSE_REFUSED: 'A prescription can no longer be filled.',
  PLACEMENT_FAILED: 'We could not place your order. Your cart is kept.',
  IN_PROGRESS: 'Your order is already being placed.',
};

const STATUS: Record<PlaceOrderFailure, number> = {
  EMPTY_CART: 422,
  ADDRESS_MISSING: 422,
  NO_DELIVERY_METHOD: 422,
  LINES_UNAVAILABLE: 422,
  TOTALS_MOVED: 409,
  PAYMENT_REQUIRED: 422,
  PAYMENT_DECLINED: 422,
  DISPENSE_REFUSED: 422,
  PLACEMENT_FAILED: 502,
  IN_PROGRESS: 409,
};

interface Body {
  expectedTotal?: { centAmount?: unknown; currencyCode?: unknown };
  cartVersion?: unknown;
}

/**
 * POST /api/checkout/place `{ expectedTotal: { centAmount, currencyCode }, cartVersion }`: places the order from the
 * server-held cart, once. The idempotency key is the cart id (from the session) plus the cart version the page
 * showed, so a second activation (double click, a retry after a lost response) answers with the first order
 * instead of creating another. `expectedTotal` is the amount the buyer saw: it is only compared with the cart and
 * with the authorized amount, never charged. Success clears the session's cart and answers `{ orderId,
 * orderNumber }`; the page redirects to `/order/<id>`. Failures answer `{ code, error }` with the cart kept.
 */
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const ctx = await checkoutContext();
    const body = (await request.json().catch(() => null)) as Body | null;
    const cents = body?.expectedTotal?.centAmount;
    const currency = body?.expectedTotal?.currencyCode;
    const version = body?.cartVersion;
    if (!Number.isSafeInteger(cents) || typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency) || !Number.isSafeInteger(version) || (version as number) < 0) {
      throw new ApiError(400, 'The request could not be processed.');
    }
    const cartId = ctx.cartId ?? (await readPaymentCart(ctx))?.id;
    if (!cartId) return Response.json({ code: 'EMPTY_CART', error: MESSAGES.EMPTY_CART }, { status: 422, headers: NO_STORE });

    let outcome;
    try {
      const provider = await getPaymentProvider();
      outcome = await placeOrder({ ctx, cartId, expectedTotal: { centAmount: cents as number, currencyCode: currency }, idempotencyKey: `${cartId}_${version as number}` }, provider);
    } catch (error) {
      if (error instanceof PaymentUnavailableError) throw new ApiError(503, error.message);
      throw error;
    }

    if (!outcome.ok) {
      return Response.json({ code: outcome.code, error: MESSAGES[outcome.code], ...(outcome.lineIds ? { lineIds: outcome.lineIds } : {}) }, { status: STATUS[outcome.code], headers: NO_STORE });
    }
    await clearCart();
    return Response.json({ orderId: outcome.orderId, orderNumber: outcome.orderNumber }, { headers: NO_STORE });
  });
}

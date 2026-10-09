import { ApiError, handle } from '@/lib/api';
import { checkoutContext } from '@/lib/checkout-route';
import { PaymentUnavailableError } from '@/lib/checkout/payment-provider';
import { getPaymentProvider } from '@/lib/checkout/provider';
import { readPaymentCart } from '@/lib/ct/checkout';
import { prepareCheckout } from '@/lib/ct/orders';
import { NO_STORE } from '@/lib/rx-route';
import { clearCart } from '@/lib/session';
import type { PlaceOrderFailure } from '@/lib/types';

/** Safe, specific sentences per outcome; the page has its own copy and uses the `code`. */
const MESSAGES: Record<PlaceOrderFailure, string> = {
  EMPTY_CART: 'Your cart is empty.',
  ADDRESS_MISSING: 'Save your delivery address first.',
  NO_DELIVERY_METHOD: 'No delivery option is available for this address.',
  LINES_UNAVAILABLE: 'An item in your cart can no longer be filled.',
  TOTALS_MOVED: 'The total changed. Please review it and continue.',
  PAYMENT_REQUIRED: 'Authorize your payment before placing the order.',
  PAYMENT_DECLINED: 'Your payment was declined.',
  DISPENSE_REFUSED: 'A prescription can no longer be filled.',
  PLACEMENT_FAILED: 'We could not start your payment. Your cart is kept.',
  COVER_UNRESOLVED: 'We could not confirm what your plan covers. Please try again shortly.',
  FUNDING_CHANGED: 'Your allowance or covered amount changed. Please review the new amounts.',
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
  COVER_UNRESOLVED: 503,
  FUNDING_CHANGED: 409,
  IN_PROGRESS: 409,
};

interface Body {
  expectedTotal?: { centAmount?: unknown; currencyCode?: unknown };
}

/**
 * POST /api/checkout/prepare `{ expectedTotal: { centAmount, currencyCode } }`: the gate before the commercetools Checkout
 * flow. Re-validates the server-held cart (prescription rules, credentials, cost-share, delivery, the total the
 * buyer saw), writes the line records and the allowance / restricted-instrument Payments onto the cart, and answers what the
 * page does next: `{ kind: 'checkout', session, cardDue }` to mount Checkout, `{ kind: 'demo', cardDue }` for the
 * dev-only demo provider, or `{ kind: 'order', orderId, orderNumber }` when nothing is left for the card (the order is made
 * and finalized here and the session cart is cleared). `expectedTotal` is only compared with the cart, never charged.
 * Failures answer `{ code, error }` with the cart kept. 503 when payment is not configured.
 */
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const ctx = await checkoutContext();
    const body = (await request.json().catch(() => null)) as Body | null;
    const cents = body?.expectedTotal?.centAmount;
    const currency = body?.expectedTotal?.currencyCode;
    if (!Number.isSafeInteger(cents) || typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) throw new ApiError(400, 'The request could not be processed.');
    const cartId = ctx.cartId ?? (await readPaymentCart(ctx))?.id;
    if (!cartId) return Response.json({ code: 'EMPTY_CART', error: MESSAGES.EMPTY_CART }, { status: 422, headers: NO_STORE });

    let outcome;
    try {
      outcome = await prepareCheckout({ ctx, cartId, expectedTotal: { centAmount: cents as number, currencyCode: currency } }, await getPaymentProvider());
    } catch (error) {
      if (error instanceof PaymentUnavailableError) throw new ApiError(503, error.message);
      throw error;
    }
    if (!outcome.ok) {
      return Response.json({ code: outcome.code, error: MESSAGES[outcome.code], ...(outcome.lineIds ? { lineIds: outcome.lineIds } : {}) }, { status: STATUS[outcome.code], headers: NO_STORE });
    }
    const { ok: _ok, ...result } = outcome;
    if (result.kind === 'order') await clearCart();
    return Response.json(result, { headers: NO_STORE });
  });
}

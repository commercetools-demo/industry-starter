import { ApiError, handle } from '@/lib/api';
import { checkoutContext } from '@/lib/checkout-route';
import { PaymentUnavailableError } from '@/lib/checkout/payment-provider';
import { getPaymentProvider } from '@/lib/checkout/provider';
import { readPaymentCart } from '@/lib/ct/checkout';
import { NO_STORE } from '@/lib/rx-route';

/**
 * POST /api/checkout/session: creates a Checkout session for the customer's cart (payment-only mode) and returns
 * what the browser SDK needs: `{ sessionId, projectKey, region, paymentMode }`. The amount is the cart's own
 * total, read from the platform now; nothing about it comes from the request (the body is not read). The
 * cart must have an address and a delivery method first (422 `ADDRESS_MISSING`). 503 when payment is not
 * configured or unreachable, with a safe message and the cart untouched.
 */
export async function POST(): Promise<Response> {
  return handle(async () => {
    const ctx = await checkoutContext();
    const cart = await readPaymentCart(ctx);
    if (!cart || cart.lineCount === 0) throw new ApiError(404, 'Not found.');
    if (!cart.shippingAddress || !cart.shippingMethodKey) {
      return Response.json({ code: 'ADDRESS_MISSING', error: 'Save your delivery address first.' }, { status: 422, headers: NO_STORE });
    }
    try {
      const provider = await getPaymentProvider();
      const session = await provider.createSession({ id: cart.id, total: cart.total });
      return Response.json({ ...session, paymentMode: provider.kind }, { headers: NO_STORE });
    } catch (error) {
      if (error instanceof PaymentUnavailableError) throw new ApiError(503, error.message);
      throw error;
    }
  });
}

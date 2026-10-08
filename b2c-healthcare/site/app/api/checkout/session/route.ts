import { ApiError, handle } from '@/lib/api';
import { checkoutContext } from '@/lib/checkout-route';
import { PaymentUnavailableError } from '@/lib/checkout/payment-provider';
import { getPaymentProvider } from '@/lib/checkout/provider';
import { readPaymentCart } from '@/lib/ct/checkout';
import { ensureTenderPayments } from '@/lib/ct/tender';
import { planTender } from '@/lib/funding/tender';
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
      // The allowance and restricted-instrument Payments go on the cart first, so the card session is for the remainder only.
      const tender = cart.tender;
      if (tender) {
        const total = cart.total.centAmount;
        const plan = planTender({ total, allowanceBalance: tender.allowance?.balance.centAmount ?? 0, eligibleSubtotal: tender.restricted.eligibleSubtotal.centAmount, restrictedChosen: tender.restricted.chosen });
        await ensureTenderPayments(cart.id, plan);
      }
      const provider = await getPaymentProvider();
      const session = await provider.createSession({ id: cart.id, total: tender?.card ?? cart.total });
      return Response.json({ ...session, paymentMode: provider.kind }, { headers: NO_STORE });
    } catch (error) {
      if (error instanceof PaymentUnavailableError) throw new ApiError(503, error.message);
      throw error;
    }
  });
}

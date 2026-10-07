import { checkoutRoute, readCheckoutBody, textOf } from '@/lib/checkout-api';
import { completeCheckout } from '@/lib/ct/checkout';
import { CheckoutRefusal } from '@/lib/checkout/refusal';

export const dynamic = 'force-dynamic';

/** The hosted Checkout created the order: verify it belongs to this session's cart, finalize it, clear the cart. Idempotent. */
export async function POST(request: Request) {
  return checkoutRoute(request, { mutating: true }, async (session) => {
    const orderId = textOf((await readCheckoutBody(request)).orderId);
    if (!orderId) throw new CheckoutRefusal(400, 'INVALID_BODY', 'orderId is required.');
    return completeCheckout(session, orderId);
  });
}

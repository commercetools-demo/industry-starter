import { handle } from '@/lib/api';
import { checkoutContext } from '@/lib/checkout-route';
import { syncCartSession } from '@/lib/cart-route';
import { readCheckout } from '@/lib/ct/checkout';
import { NO_STORE } from '@/lib/rx-route';

/**
 * GET /api/checkout: the checkout page's data, read from the platform now (recalculated cart, every line
 * re-validated, delivery options for the cart's address). `null` when there is no cart. Never cached.
 */
export async function GET(): Promise<Response> {
  return handle(async () => {
    const ctx = await checkoutContext();
    const state = await readCheckout(ctx);
    await syncCartSession(state?.cart ?? null);
    return Response.json(state, { headers: NO_STORE });
  });
}

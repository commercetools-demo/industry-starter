import { ApiError, handle } from '@/lib/api';
import { validateAddress } from '@/lib/address';
import { checkoutContext } from '@/lib/checkout-route';
import { setCheckoutAddress } from '@/lib/ct/checkout';
import { NO_STORE } from '@/lib/rx-route';

/**
 * PUT /api/checkout/address: sets the cart's shipping address (format-validated with the same function the form
 * runs), keeps the delivery method valid for it, and answers with the cart as re-read from the platform: shipping,
 * tax and total are the platform's. 422 `NO_DELIVERY_METHOD` (with the state) when no method serves the address.
 */
export async function PUT(request: Request): Promise<Response> {
  return handle(async () => {
    const ctx = await checkoutContext();
    const body: unknown = await request.json().catch(() => null);
    const checked = validateAddress(body);
    if (!checked.ok) return Response.json({ error: 'Check the highlighted fields.', fields: checked.problems }, { status: 400, headers: NO_STORE });
    const state = await setCheckoutAddress(ctx, checked.value);
    if (!state) throw new ApiError(404, 'Not found.');
    if (!state.deliverable) {
      return Response.json({ code: 'NO_DELIVERY_METHOD', error: 'We cannot deliver to this address.', state }, { status: 422, headers: NO_STORE });
    }
    return Response.json(state, { headers: NO_STORE });
  });
}

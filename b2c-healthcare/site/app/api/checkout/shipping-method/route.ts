import { ApiError, handle } from '@/lib/api';
import { checkoutContext } from '@/lib/checkout-route';
import { setCheckoutShippingMethod } from '@/lib/ct/checkout';
import { NO_STORE } from '@/lib/rx-route';

const METHOD_KEY = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * PUT /api/checkout/shipping-method `{ key }`: selects a delivery method the platform offers for the cart now and
 * answers with the re-read cart. A method that is not offered (out of area, or same-day after the cut-off) is
 * 422 `METHOD_UNAVAILABLE` with the current state; nothing changes.
 */
export async function PUT(request: Request): Promise<Response> {
  return handle(async () => {
    const ctx = await checkoutContext();
    const body = (await request.json().catch(() => null)) as { key?: unknown } | null;
    if (typeof body?.key !== 'string' || !METHOD_KEY.test(body.key)) throw new ApiError(400, 'The request could not be processed.');
    const outcome = await setCheckoutShippingMethod(ctx, body.key);
    if (!outcome) throw new ApiError(404, 'Not found.');
    if (!outcome.accepted) {
      return Response.json({ code: 'METHOD_UNAVAILABLE', error: 'This delivery option is not available.', state: outcome.state }, { status: 422, headers: NO_STORE });
    }
    return Response.json(outcome.state, { headers: NO_STORE });
  });
}

import { ApiError, handle } from '@/lib/api';
import { checkoutContext } from '@/lib/checkout-route';
import { setCheckoutRestricted } from '@/lib/ct/checkout';
import { NO_STORE } from '@/lib/rx-route';

/**
 * PUT /api/checkout/tender `{ restricted: boolean }`: the patient chooses (or drops) the restricted instrument,
 * "Health account card (demo)". It pays only the eligible subtotal; a basket with nothing eligible refuses with 422
 * `NONE_ELIGIBLE` and the current state (the reason is shown). The allowance needs no choice: it is always drawn first.
 * The answer is the checkout state re-read afterwards, so the card amount is the server's. There is no other tender
 * endpoint: nothing here, or anywhere, moves an allowance out of the order flow.
 */
export async function PUT(request: Request): Promise<Response> {
  return handle(async () => {
    const ctx = await checkoutContext();
    const body = (await request.json().catch(() => null)) as { restricted?: unknown } | null;
    if (typeof body?.restricted !== 'boolean') throw new ApiError(400, 'The request could not be processed.');
    const outcome = await setCheckoutRestricted(ctx, body.restricted);
    if (!outcome) throw new ApiError(404, 'Not found.');
    if (!outcome.ok) {
      return Response.json({ code: 'NONE_ELIGIBLE', error: 'None of the items in your basket can be paid with this instrument.', state: outcome.state }, { status: 422, headers: NO_STORE });
    }
    return Response.json(outcome.state, { headers: NO_STORE });
  });
}

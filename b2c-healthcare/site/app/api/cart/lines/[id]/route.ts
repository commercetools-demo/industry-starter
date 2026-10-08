import { ApiError, handle, requireCustomer } from '@/lib/api';
import { removeLine } from '@/lib/ct/cart';
import { syncCartSession } from '@/lib/cart-route';
import { NO_STORE, requirePatient, rxContextOf } from '@/lib/rx-route';

type Context = { params: Promise<{ id: string }> };
const LINE_ID = /^[\w-]{1,100}$/;

/** DELETE /api/cart/lines/{id}: removes one line; the answer is the platform's recalculated cart (or `null`). */
export async function DELETE(_request: Request, { params }: Context): Promise<Response> {
  return handle(async () => {
    const session = await requireCustomer();
    const { id } = await params;
    if (!LINE_ID.test(id)) throw new ApiError(400, 'The request could not be processed.');
    const patient = await requirePatient(session.customerId);
    const outcome = await removeLine(session.customerId, session.cartId, id, rxContextOf(session).currency, patient);
    await syncCartSession(outcome?.cart ?? null);
    return Response.json({ cart: outcome?.cart ?? null }, { headers: NO_STORE });
  });
}

/** PATCH: there is no quantity change. The quantity is what the doctor prescribed (design-cart: No quantity editing). */
export async function PATCH(): Promise<Response> {
  return handle(async () => {
    await requireCustomer();
    return Response.json({ code: 'QUANTITY_FIXED', error: 'The quantity is set by the prescription and cannot be changed.' }, { status: 400, headers: NO_STORE });
  });
}

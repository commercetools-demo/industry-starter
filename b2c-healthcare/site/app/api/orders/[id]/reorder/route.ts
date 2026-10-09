import { handle, requireCustomer } from '@/lib/api';
import { syncCartSession } from '@/lib/cart-route';
import { getRawOrderForCustomer } from '@/lib/ct/orders-read';
import { reorderOrder } from '@/lib/ct/orders-reorder';
import { localeOfSession, orderNotFound } from '@/lib/order-route';
import { requirePatient, rxContextOf } from '@/lib/rx-route';

/**
 * POST /api/orders/:id/reorder: puts the medications of one of the customer's past orders into the cart again. Every
 * line is re-validated now (own prescription, refills, expiry, stock, ceilings, shelf life); the dispensable ones are
 * added, the others are named with their reason in `notAdded`. Answers `{ added, notAdded }` (200 even when nothing
 * could be added: the list of reasons is the answer). A foreign or unknown order id answers the same 404.
 */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const session = await requireCustomer();
    const { id } = await ctx.params;
    const order = await getRawOrderForCustomer(id, session.customerId);
    if (!order) throw orderNotFound();
    const patient = await requirePatient(session.customerId);
    const { result, cartId } = await reorderOrder(order, { customerId: session.customerId, cartId: session.cartId, patient, ctx: rxContextOf(session), locale: localeOfSession(session) });
    if (cartId) await syncCartSession({ id: cartId });
    return result;
  });
}

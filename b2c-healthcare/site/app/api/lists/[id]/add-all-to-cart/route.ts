import { handle, requireCustomer } from '@/lib/api';
import { syncCartSession } from '@/lib/cart-route';
import { addListToCart } from '@/lib/ct/lists-add-all';
import { getOwnList } from '@/lib/ct/shopping-lists';
import { listNotFound } from '@/lib/list-route';
import { requirePatient, rxContextOf } from '@/lib/rx-route';

/**
 * POST /api/lists/:id/add-all-to-cart: one operation. Every line is re-validated now (prescription rules, stock,
 * ceilings); the dispensable ones go into the cart at the platform's prices, each one that could not be added is named
 * with a reason. Answers `{ added[], notAdded[{ name, reason }] }` (200 also when nothing could be added: the reasons
 * are the answer). The list is not changed. A foreign or unknown id answers the same 404.
 */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const session = await requireCustomer();
    const { id } = await ctx.params;
    const list = await getOwnList(id, session.customerId);
    if (!list) throw listNotFound();
    const patient = await requirePatient(session.customerId);
    const { result, cartId } = await addListToCart(list, { customerId: session.customerId, cartId: session.cartId, patient, ctx: rxContextOf(session) });
    if (cartId) await syncCartSession({ id: cartId });
    return result;
  });
}

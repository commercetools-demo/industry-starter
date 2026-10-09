import { handle, requireCustomer } from '@/lib/api';
import { readJsonObject } from '@/lib/auth-route';
import { createListFromCart } from '@/lib/ct/list-view';
import { createList, listLists } from '@/lib/ct/shopping-lists';
import { listLimitError } from '@/lib/list-route';
import { localeOfSession } from '@/lib/order-route';
import { mapListSummary } from '@/lib/mappers/shopping-list';
import { rxContextOf } from '@/lib/rx-route';

/** GET /api/lists: the signed-in customer's saved lists, most recently changed first. 401 without a session; never cached. */
export async function GET(): Promise<Response> {
  return handle(async () => {
    const session = await requireCustomer();
    return { lists: await listLists(session.customerId, localeOfSession(session)) };
  });
}

/** POST /api/lists { name, fromCart? }: creates an empty list, or a list of the prescription lines in the cart. 422 for an empty name or an empty cart. */
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const session = await requireCustomer();
    const body = await readJsonObject(request);
    const locale = localeOfSession(session);
    try {
      const name = typeof body.name === 'string' ? body.name : '';
      const list = body.fromCart === true ? await createListFromCart(session.customerId, session.cartId, name, rxContextOf(session)) : await createList(session.customerId, name, locale);
      return Response.json(mapListSummary(list, locale), { status: 201 });
    } catch (error) {
      return listLimitError(error);
    }
  });
}

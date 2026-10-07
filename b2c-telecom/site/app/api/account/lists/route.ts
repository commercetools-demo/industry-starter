import { accountRoute, readJsonBody } from '@/lib/api/account-api';
import { withListErrors } from '@/lib/api/lists-api';
import { readBundle } from '@/lib/ct/bundle';
import { createList, createListFromCart, getLists, toDetail } from '@/lib/ct/lists';
import { getSession } from '@/lib/ct/session';
import { getMarket } from '@/lib/market/server';

export const dynamic = 'force-dynamic';

/** The signed-in customer's lists, newest change first. */
export async function GET(request: Request) {
  return accountRoute(request, {}, async ({ session }) => ({ lists: await getLists(session.customerId) }));
}

/** Creates a list; `fromCart: true` copies the current bundle into it (the cart is the session's, never one named by the client). */
export async function POST(request: Request) {
  return accountRoute(request, { mutating: true, status: 201 }, ({ session }) =>
    withListErrors(async () => {
      const body = await readJsonBody(request);
      const market = await getMarket();
      if (body.fromCart === true) {
        const { cart } = await readBundle(await getSession(), market);
        return { list: await toDetail(await createListFromCart(session.customerId, body.name, cart, market), market) };
      }
      return { list: await toDetail(await createList(session.customerId, body.name), market) };
    }),
  );
}

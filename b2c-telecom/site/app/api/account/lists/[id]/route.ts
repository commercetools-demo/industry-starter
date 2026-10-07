import { accountRoute, readJsonBody } from '@/lib/api/account-api';
import { withListErrors } from '@/lib/api/lists-api';
import { deleteList, getList, getLists, renameList, toDetail } from '@/lib/ct/lists';
import { getMarket } from '@/lib/market/server';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

// The id in the URL is only a request for one of THIS customer's lists: `readOwned` answers a foreign or unknown id with the same 404.

export async function GET(request: Request, { params }: Context) {
  return accountRoute(request, {}, ({ session }) =>
    withListErrors(async () => {
      const { id } = await params;
      return { list: await getList(session.customerId, id, await getMarket()) };
    }),
  );
}

export async function PATCH(request: Request, { params }: Context) {
  return accountRoute(request, { mutating: true }, ({ session }) =>
    withListErrors(async () => {
      const { id } = await params;
      const body = await readJsonBody(request);
      return { list: await toDetail(await renameList(session.customerId, id, body.name), await getMarket()) };
    }),
  );
}

export async function DELETE(request: Request, { params }: Context) {
  return accountRoute(request, { mutating: true }, ({ session }) =>
    withListErrors(async () => {
      const { id } = await params;
      await deleteList(session.customerId, id);
      return { lists: await getLists(session.customerId) };
    }),
  );
}

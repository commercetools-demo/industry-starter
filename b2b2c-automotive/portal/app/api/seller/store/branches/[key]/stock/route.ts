// GET /api/seller/store/branches/[key]/stock?storeKey=&offset=&text= (workstream U-05, Q-005): the store's assigned parts with the
// stock on this branch and the branch price (empty: the store price applies), 50 per page.
import { listBranchStock } from '@/lib/ct/seller/branch-stock';
import { json } from '@/lib/portal/route-kit';
import { authorizeQuery, storeHandle } from '@/lib/portal/store-route';

export const GET = storeHandle(async (request: Request, context: { params: Promise<{ key: string }> }) => {
  const { storeKey } = await authorizeQuery(request, 'store.view');
  const { key } = await context.params;
  const params = new URL(request.url).searchParams;
  const offset = Number(params.get('offset') ?? '0');
  return json(await listBranchStock(storeKey, key, { offset: Number.isInteger(offset) && offset >= 0 ? offset : 0, text: params.get('text')?.slice(0, 100) ?? undefined }));
});

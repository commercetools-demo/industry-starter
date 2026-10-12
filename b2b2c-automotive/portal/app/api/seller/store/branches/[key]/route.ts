// PUT and DELETE /api/seller/store/branches/[key] (workstream U-05): edit a branch, or remove it from the store's supply and
// distribution channels (the channel itself stays). A branch of another store is a 404, whatever its key looks like.
import { removeBranch, updateBranch } from '@/lib/ct/seller/branches';
import { json } from '@/lib/portal/route-kit';
import { authorizeBody, authorizeQuery, storeHandle } from '@/lib/portal/store-route';
import { branchInput } from '@/lib/store/schemas';

type Context = { params: Promise<{ key: string }> };

export const PUT = storeHandle(async (request: Request, context: Context) => {
  const { storeKey, body } = await authorizeBody(request, 'store.edit', branchInput);
  const { key } = await context.params;
  return json({ branch: await updateBranch(storeKey, key, body) });
});

export const DELETE = storeHandle(async (request: Request, context: Context) => {
  const { storeKey } = await authorizeQuery(request, 'store.edit');
  const { key } = await context.params;
  await removeBranch(storeKey, key);
  return json({ status: 'removed' });
});

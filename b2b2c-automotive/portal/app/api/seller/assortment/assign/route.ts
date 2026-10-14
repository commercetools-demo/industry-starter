// POST /api/seller/assortment/assign { storeKey, productIds | filter } : assign or reinstate (T-03). Never confirms.
// "Never widen": a blocked upstream part, or one outside the Malva catalog that is not the store's own, is 409 BLOCKED_UPSTREAM.
import { AssignBody } from '@/lib/catalog/route-schemas';
import { resolveFilterIds } from '@/lib/ct/seller/assortment';
import { assignProducts } from '@/lib/ct/seller/assortment-write';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, sellerHandle } from '@/lib/portal/seller-route';

export const POST = sellerHandle(async (request: Request) => {
  const body = await authorizedBody(request, AssignBody, 'catalog.edit');
  const ids = body.productIds ?? (await resolveFilterIds(body.storeKey, body.filter ?? {}, 'assign'));
  return json(await assignProducts(body.storeKey, ids));
});

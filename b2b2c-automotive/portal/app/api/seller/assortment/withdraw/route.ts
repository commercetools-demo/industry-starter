// POST /api/seller/assortment/withdraw { storeKey, productIds | filter, confirm, expectedCount } (T-03).
// Without `confirm: true` and the exact count the answer is 409 CONFIRMATION_REQUIRED with the impact (count, open carts, branches).
import { WithdrawBody } from '@/lib/catalog/route-schemas';
import { resolveFilterIds } from '@/lib/ct/seller/assortment';
import { withdrawProducts } from '@/lib/ct/seller/assortment-write';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, sellerHandle } from '@/lib/portal/seller-route';

export const POST = sellerHandle(async (request: Request) => {
  const body = await authorizedBody(request, WithdrawBody, 'catalog.edit');
  const ids = body.productIds ?? (await resolveFilterIds(body.storeKey, body.filter ?? {}, 'withdraw'));
  return json(await withdrawProducts(body.storeKey, ids, { confirm: body.confirm === true, expectedCount: body.expectedCount ?? -1 }));
});

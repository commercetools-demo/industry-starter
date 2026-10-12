// PUT /api/seller/discounts/priority { storeKey, kind, orderedIds } : saves the rank of the store's own discounts of a kind (T-09).
// `orderedIds` must be exactly the store's reseller discounts of that kind (409 STALE_LIST otherwise); Malva-funded ones are
// never part of it. Rank 1 gets the sortOrder that applies first.
import { PriorityBody } from '@/lib/catalog/route-schemas';
import { reorderDiscounts } from '@/lib/ct/seller/discounts';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, sellerHandle } from '@/lib/portal/seller-route';

export const PUT = sellerHandle(async (request: Request) => {
  const body = await authorizedBody(request, PriorityBody, 'discount.edit');
  return json(await reorderDiscounts(body.storeKey, body.kind, body.orderedIds));
});

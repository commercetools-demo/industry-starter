// POST /api/seller/assortment/reconcile { storeKey } : removes parts that are no longer approved upstream (T-03, propagation P5).
import { ReconcileBody } from '@/lib/catalog/route-schemas';
import { reconcileAssortment } from '@/lib/ct/seller/assortment-write';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, sellerHandle } from '@/lib/portal/seller-route';

export const POST = sellerHandle(async (request: Request) => {
  const body = await authorizedBody(request, ReconcileBody, 'catalog.edit');
  return json(await reconcileAssortment(body.storeKey));
});

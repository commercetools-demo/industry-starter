// GET /api/seller/subscriptions?storeKey= : the store's recurring orders with KPIs and the renewals of the next 7 days (V-09). Admin only.
import { listSubscriptions } from '@/lib/ct/seller/subscriptions';
import { json } from '@/lib/portal/route-kit';
import { authorizeSeller, sellerHandle, storeKeyParam } from '@/lib/portal/seller-route';
import { localeParam } from '@/lib/portal/v-route';

export const GET = sellerHandle(async (request: Request) => {
  const storeKey = storeKeyParam(request);
  await authorizeSeller(storeKey, 'subscriptions.view');
  return json(await listSubscriptions(storeKey, localeParam(request)));
});

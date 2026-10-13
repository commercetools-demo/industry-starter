// GET /api/seller/customers/[id]?storeKey= : one shopper with orders, garage, consent, subscriptions, returns and notes (V-03, V-05).
// The customer is read through the in-store endpoint, so a customer of another store is a 404 (never a 200). Admin only: the e-mail
// address is shown in full.
import { getCustomerDetail } from '@/lib/ct/seller/customers';
import { json } from '@/lib/portal/route-kit';
import { authorizeSeller, sellerHandle, storeKeyParam } from '@/lib/portal/seller-route';
import { localeParam } from '@/lib/portal/v-route';
import { pathParam, type Params } from '@/lib/portal/w-route';

export const GET = sellerHandle(async (request: Request, context: Params<'id'>) => {
  const storeKey = storeKeyParam(request);
  await authorizeSeller(storeKey, 'customers.view');
  const id = await pathParam(context, 'id');
  return json(await getCustomerDetail(storeKey, id, ['admin'], localeParam(request)));
});

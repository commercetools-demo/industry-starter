// GET /api/seller/returns/[number]?storeKey= : one return with its lines, refund state and (for "wrong fit") the vehicle and fit result
// recorded at purchase (V-13, V-14). The order is read in-store: another store's return is a 404.
import { getReturn } from '@/lib/ct/seller/returns';
import { json } from '@/lib/portal/route-kit';
import { authorizeSeller, sellerHandle, storeKeyParam } from '@/lib/portal/seller-route';
import { localeParam } from '@/lib/portal/v-route';
import { pathParam, type Params } from '@/lib/portal/w-route';

export const GET = sellerHandle(async (request: Request, context: Params<'number'>) => {
  const storeKey = storeKeyParam(request);
  await authorizeSeller(storeKey, 'returns.view');
  return json(await getReturn(storeKey, await pathParam(context, 'number'), localeParam(request)));
});

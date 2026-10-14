// GET /api/seller/orders/[number]?storeKey= : the lines of an order with the quantity already returned and the delivery date, for the
// "Record a return" dialog (V-13). Read in-store: another store's order is a 404 "Order not found".
import { getOrderForReturn } from '@/lib/ct/seller/returns';
import { json } from '@/lib/portal/route-kit';
import { authorizeSeller, sellerHandle, storeKeyParam } from '@/lib/portal/seller-route';
import { pathParam, type Params } from '@/lib/portal/w-route';

export const GET = sellerHandle(async (request: Request, context: Params<'number'>) => {
  const storeKey = storeKeyParam(request);
  await authorizeSeller(storeKey, 'returns.view');
  return json(await getOrderForReturn(storeKey, await pathParam(context, 'number')));
});

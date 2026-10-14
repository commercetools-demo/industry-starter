// GET /api/seller/prices?storeKey=&currency=&text=&offset=&limit= : the price table (T-05).
// PUT /api/seller/prices { storeKey, currency?, changes: [{ sku, centAmount | null }], confirm, expectedCount } : publish (T-06).
// The server owns the facts: the body is strict, so a client can never send a list price, a cost or a currency per change.
// A price is valid when it is above zero with two decimals; there is no floor. All writes go through `publishPrices`.
import { PublishBody } from '@/lib/catalog/route-schemas';
import { listPrices, publishPrices } from '@/lib/ct/seller/prices';
import { ApiError, json } from '@/lib/portal/route-kit';
import { authorizedBody, authorizeSeller, intParam, sellerHandle, storeKeyParam, textParam } from '@/lib/portal/seller-route';

export const GET = sellerHandle(async (request: Request) => {
  const storeKey = storeKeyParam(request);
  await authorizeSeller(storeKey, 'catalog.view');
  const currency = new URL(request.url).searchParams.get('currency') ?? undefined;
  if (currency !== undefined && currency !== 'EUR' && currency !== 'USD') throw new ApiError(400, 'Unknown currency');
  return json(await listPrices(storeKey, { currency, text: textParam(request, 'text'), offset: intParam(request, 'offset', 0, 100_000), limit: intParam(request, 'limit', 50, 200) }));
});

export const PUT = sellerHandle(async (request: Request) => {
  const body = await authorizedBody(request, PublishBody, 'price.edit');
  return json(await publishPrices(body.storeKey, { currency: body.currency, changes: body.changes, confirm: body.confirm, expectedCount: body.expectedCount }));
});

// POST /api/seller/prices/bulk { storeKey, currency?, mode: 'percentOfList' | 'setTo', value, skus | filter, dryRun } (T-06).
// `dryRun: true` returns the new price and the distance from the Malva list per part, and flags results of zero or less; it
// writes nothing. Publishing goes through `publishPrices` (validate all, confirm the count, then write).
import { BulkBody } from '@/lib/catalog/route-schemas';
import { previewBulk, publishBulk } from '@/lib/ct/seller/prices';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, sellerHandle } from '@/lib/portal/seller-route';

export const POST = sellerHandle(async (request: Request) => {
  const body = await authorizedBody(request, BulkBody, 'price.edit');
  const edit = { currency: body.currency, mode: body.mode, value: body.value, skus: body.skus, filter: body.filter };
  if (body.dryRun) return json(await previewBulk(body.storeKey, edit));
  return json(await publishBulk(body.storeKey, { ...edit, confirm: body.confirm, expectedCount: body.expectedCount }));
});

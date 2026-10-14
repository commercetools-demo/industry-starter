// POST /api/seller/prices/import { storeKey, currency?, csv, dryRun, confirm, expectedCount } (T-06): CSV `sku;price`, at most 2000
// rows. A dry run (or a missing confirmation) previews every row; publishing goes through `publishPrices`.
import { parsePriceCsv } from '@/lib/catalog/price-import';
import { ImportBody } from '@/lib/catalog/route-schemas';
import { previewChanges, publishPrices } from '@/lib/ct/seller/prices';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, sellerHandle } from '@/lib/portal/seller-route';

export const POST = sellerHandle(async (request: Request) => {
  const body = await authorizedBody(request, ImportBody, 'price.edit');
  const { rows, problems } = parsePriceCsv(body.csv);
  if (problems.length) return json({ error: problems[0].message, code: 'CSV_INVALID', problems }, { status: 400 });
  if (rows.length === 0) return json({ error: 'The file has no rows', code: 'CSV_INVALID', problems: [] }, { status: 400 });
  const changes = rows.map((r) => ({ sku: r.sku, centAmount: r.centAmount }));
  if (body.dryRun) return json(await previewChanges(body.storeKey, { currency: body.currency, changes }));
  return json(await publishPrices(body.storeKey, { currency: body.currency, changes, confirm: body.confirm, expectedCount: body.expectedCount }));
});

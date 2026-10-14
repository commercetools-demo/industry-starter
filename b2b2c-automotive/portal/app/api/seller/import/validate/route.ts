// POST /api/seller/import/validate { storeKey, csv, overrides? } : the validation report of a product CSV (W-13). Never persists.
// The report has counts, the column mapping and the row-level issues with their effect (Skipped, Default used).
import { validateFile } from '@/lib/ct/seller/product-import';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, sellerHandle } from '@/lib/portal/seller-route';
import { ImportBody } from '@/lib/portal/w-schemas';

export const POST = sellerHandle(async (request: Request) => {
  const body = await authorizedBody(request, ImportBody, 'import.run');
  return json(await validateFile(body.storeKey, body.csv, body.overrides));
});

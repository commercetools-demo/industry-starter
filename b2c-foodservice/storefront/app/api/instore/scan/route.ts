import { handle, jsonError } from '@/lib/api';
import { isInstore } from '@/lib/app-mode';
import { getScanProduct } from '@/lib/ct/instore-scan';
import { limitClient } from '@/lib/http/limit';
import { SKU_PATTERN } from '@/lib/instore/scan';
import { getMarket } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/instore/scan?sku=<SKU> (workstream R, D-045): the product a scanned barcode leads to, for the scanner dialog.
 * 200 `{ product: ScanProduct }` (image, name, variant attributes, price, availability, quantity limits).
 * 400 validation_failed: the text is not a SKU (nothing is looked up). 404 not_found: the shop does not sell this code, and
 * also every call when the app is not in the In-store mode (the website has no such feature). 429 rate_limited.
 * The market comes from the session, never from the client. Answers are never cached (stock changes).
 */
export const GET = handle('/api/instore/scan', async (req) => {
  if (!isInstore()) return jsonError('not_found', 404);
  const limited = limitClient(req, 'instore-scan', { limit: 120, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;
  const sku = new URL(req.url).searchParams.get('sku') ?? '';
  if (!SKU_PATTERN.test(sku)) return jsonError('validation_failed', 400);
  const market = await getMarket();
  const product = await getScanProduct(sku, market.locale);
  if (!product) return jsonError('not_found', 404);
  return Response.json({ product }, { headers: { 'Cache-Control': 'no-store' } });
});

import { handle, jsonError } from '@/lib/api';
import { getStoresForCountry } from '@/lib/ct/channels';
import { SKU_PATTERN, getStoreAvailability } from '@/lib/ct/inventory';
import { getMarket } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/availability?sku=<sku>
 * 200 { sku, ship, stores: [{ storeKey, state, quantity }] } for the stores of the session country (none in Canada).
 * 400 validation_failed for a malformed sku. An unknown sku answers all `out`. Never cached.
 */
export const GET = handle('/api/availability', async (req) => {
  const sku = new URL(req.url).searchParams.get('sku') ?? '';
  if (!SKU_PATTERN.test(sku)) return jsonError('validation_failed', 400);
  const market = await getMarket();
  const stores = await getStoresForCountry(market.country, market.locale);
  const availability = await getStoreAvailability(sku, stores);
  return Response.json(availability, { headers: { 'Cache-Control': 'no-store' } });
});

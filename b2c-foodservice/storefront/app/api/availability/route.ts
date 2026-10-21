import { handle, jsonError } from '@/lib/api';
import { getStoresForCountry } from '@/lib/ct/channels';
import { SKU_PATTERN, getStoreAvailability } from '@/lib/ct/inventory';
import { knownCountry } from '@/lib/request-market';
import { getMarket } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/availability?sku=<sku>[&country=US] (country = the page's market; default the session's)
 * 200 { sku, ship, stores: [{ storeKey, state, quantity }] } for the stores of the session country (none in Canada).
 * 400 validation_failed for a malformed sku. An unknown sku answers all `out`. Never cached.
 */
export const GET = handle('/api/availability', async (req) => {
  const sku = new URL(req.url).searchParams.get('sku') ?? '';
  if (!SKU_PATTERN.test(sku)) return jsonError('validation_failed', 400);
  const market = await getMarket();
  const param = new URL(req.url).searchParams.get('country');
  const country = param === null ? market.country : knownCountry(param);
  if (country === null) return jsonError('validation_failed', 400);
  const stores = await getStoresForCountry(country, market.locale);
  const availability = await getStoreAvailability(sku, stores);
  return Response.json(availability, { headers: { 'Cache-Control': 'no-store' } });
});

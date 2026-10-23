import { handle, jsonError } from '@/lib/api';
import { getStoresForCountry } from '@/lib/ct/channels';
import { getMarket, getSession } from '@/lib/session';
import { COUNTRY_CONFIG } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const COUNTRY = /^[A-Z]{2}$/;

/**
 * GET /api/channels?country=US
 * 200 { stores: Store[], selectedKey: string | null }. Stores of the country sorted by city; Canada has none (D-035).
 * selectedKey is the session's collection store only when that store belongs to the country.
 */
export const GET = handle('/api/channels', async (req) => {
  const [session, market] = await Promise.all([getSession(), getMarket()]);
  const param = new URL(req.url).searchParams.get('country');
  let country = market.country;
  if (param !== null) {
    const known = COUNTRY.test(param) && Object.values(COUNTRY_CONFIG).some((m) => m.country === param);
    if (!known) return jsonError('bad_request', 400);
    country = param;
  }
  const stores = await getStoresForCountry(country, market.locale);
  const selectedKey =
    session.collectionStoreKey && stores.some((s) => s.key === session.collectionStoreKey)
      ? session.collectionStoreKey
      : null;
  return Response.json({ stores, selectedKey });
});

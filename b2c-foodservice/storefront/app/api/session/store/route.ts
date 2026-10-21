import { NextResponse } from 'next/server';
import { handle, jsonError } from '@/lib/api';
import { getStoresForCountry } from '@/lib/ct/channels';
import { knownCountry } from '@/lib/request-market';
import { createSessionToken, getMarket, getSession, setSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/session/store { storeKey: string | null, country?: 'US' } (country = the page's market; default the session's)
 * 200 { storeKey }; 400 validation_failed when the key is not a store of the session country; null clears.
 * Writes only `collectionStoreKey`; the cart is not touched (collect lines keep their own store).
 */
export const PUT = handle('/api/session/store', async (req) => {
  const raw: unknown = await req.json().catch(() => null);
  const input = (raw ?? {}) as { storeKey?: unknown; country?: unknown };
  const storeKey = input.storeKey;
  if (storeKey !== null && typeof storeKey !== 'string') return jsonError('validation_failed', 400);

  const [session, market] = await Promise.all([getSession(), getMarket()]);
  const country = input.country === undefined ? market.country : knownCountry(input.country);
  if (country === null) return jsonError('validation_failed', 400);
  const next = { ...session };
  if (storeKey === null) {
    delete next.collectionStoreKey;
  } else {
    const stores = await getStoresForCountry(country, market.locale);
    if (!stores.some((s) => s.key === storeKey)) return jsonError('validation_failed', 400);
    next.collectionStoreKey = storeKey;
  }
  return setSessionCookie(NextResponse.json({ storeKey }), await createSessionToken(next));
});

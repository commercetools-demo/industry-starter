import { NextResponse } from 'next/server';
import { handle, jsonError } from '@/lib/api';
import { getStoresForCountry } from '@/lib/ct/channels';
import { createSessionToken, getMarket, getSession, setSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/session/store { storeKey: string | null }
 * 200 { storeKey }; 400 validation_failed when the key is not a store of the session country; null clears.
 * Writes only `collectionStoreKey`; the cart is not touched (collect lines keep their own store).
 */
export const PUT = handle('/api/session/store', async (req) => {
  const raw: unknown = await req.json().catch(() => null);
  const storeKey = (raw as { storeKey?: unknown } | null)?.storeKey;
  if (storeKey !== null && typeof storeKey !== 'string') return jsonError('validation_failed', 400);

  const [session, market] = await Promise.all([getSession(), getMarket()]);
  const next = { ...session };
  if (storeKey === null) {
    delete next.collectionStoreKey;
  } else {
    const stores = await getStoresForCountry(market.country, market.locale);
    if (!stores.some((s) => s.key === storeKey)) return jsonError('validation_failed', 400);
    next.collectionStoreKey = storeKey;
  }
  return setSessionCookie(NextResponse.json({ storeKey }), await createSessionToken(next));
});

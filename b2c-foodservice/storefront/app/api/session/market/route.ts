import { NextResponse } from 'next/server';
import { handle, jsonError } from '@/lib/api';
import { getStoresForCountry } from '@/lib/ct/channels';
import { validateMarket } from '@/lib/ct/market';
import {
  changeMarket, createSessionToken, getSession, setMarketCookie, setSessionCookie,
} from '@/lib/session';
import type { LocaleKey } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/session/market { country: 'CA' }
 * 200 { country, currency, locale, cartCarriedOver, droppedLines }; 400 validation_failed for an unsupported market.
 * Country, currency and locale change together. The cart id is dropped when the currency changes (a cart is bound to
 * its currency); a change to the same currency keeps it. The collection store is cleared when it is not in the new
 * country. Customer fields are always kept. Workstream I extends this with carry over (I-12); the two response
 * fields already exist so the client does not change.
 */
export const PUT = handle('/api/session/market', async (req) => {
  const raw: unknown = await req.json().catch(() => null);
  const country = (raw as { country?: unknown } | null)?.country;
  if (typeof country !== 'string') return jsonError('validation_failed', 400);
  const target = await validateMarket(country);
  if (!target) return jsonError('validation_failed', 400);

  const session = await getSession();
  const sameCurrency = session.currency === target.currency;
  // changeMarket sets the three market fields together and drops cartId; keep the cart when nothing priced changes.
  let next = changeMarket(session, target.locale as LocaleKey);
  if (sameCurrency && session.cartId) next = { ...next, cartId: session.cartId };

  if (next.collectionStoreKey) {
    const stores = await getStoresForCountry(target.country, target.locale).catch(() => []);
    if (!stores.some((s) => s.key === next.collectionStoreKey)) delete next.collectionStoreKey;
  }

  const body = {
    country: target.country, currency: target.currency, locale: target.locale,
    cartCarriedOver: false, droppedLines: [] as string[],
  };
  const res = setSessionCookie(NextResponse.json(body), await createSessionToken(next));
  return setMarketCookie(res, target.locale as LocaleKey);
});

import { NextResponse } from 'next/server';
import { handle, jsonError } from '@/lib/api';
import { getOwnedCartForRebuild, rebuildCart } from '@/lib/ct/cart';
import { getStoresForCountry } from '@/lib/ct/channels';
import { validateMarket } from '@/lib/ct/market';
import {
  changeMarket, createSessionToken, getSession, setMarketCookie, setSessionCookie,
} from '@/lib/session';
import { CART_CARRY_OVER_ENABLED } from '@/lib/shop-config';
import type { DroppedLine, LocaleKey } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/session/market { country: 'CA', locale?: 'en-CA' } (locale only for a language change inside the country)
 * 200 { country, currency, locale, cartCarriedOver, droppedLines, droppedCodes }; 400 validation_failed for an unsupported market.
 * Country, currency and locale change together. A cart is bound to its currency: when the currency changes and the bag
 * has lines, `rebuildCart` (workstream I, I-12) moves it into a new cart in the new market (collect lines of another
 * country become delivery lines, lines without a price there are listed in `droppedLines`, never dropped silently, codes
 * are re-applied or ignored) and the old cart expires in a day. An empty or missing bag changes nothing in the cart. A
 * change to the same currency keeps the cart. The collection store is cleared when it is not in the new country.
 * Customer fields are always kept.
 */
export const PUT = handle('/api/session/market', async (req) => {
  const raw: unknown = await req.json().catch(() => null);
  const input = (raw ?? {}) as { country?: unknown; locale?: unknown };
  if (typeof input.country !== 'string') return jsonError('validation_failed', 400);
  if (input.locale !== undefined && typeof input.locale !== 'string') return jsonError('validation_failed', 400);
  const target = await validateMarket(input.country, input.locale);
  if (!target) return jsonError('validation_failed', 400);

  const session = await getSession();
  const sameCurrency = session.currency === target.currency;
  // changeMarket sets the three market fields together and drops cartId; keep the cart when nothing priced changes.
  let next = changeMarket(session, target.locale as LocaleKey);
  if (sameCurrency && session.cartId) next = { ...next, cartId: session.cartId };

  let cartCarriedOver = false;
  let droppedLines: DroppedLine[] = [];
  let droppedCodes: string[] = [];
  if (CART_CARRY_OVER_ENABLED && !sameCurrency && session.cartId) {
    const old = await getOwnedCartForRebuild(session);
    if (old && old.lineItems.length > 0) {
      const moved = await rebuildCart(next, old, { country: target.country, currency: target.currency, locale: target.locale });
      next = moved.session;
      cartCarriedOver = true;
      droppedLines = moved.dropped;
      droppedCodes = moved.droppedCodes;
    }
  }

  if (next.collectionStoreKey) {
    const stores = await getStoresForCountry(target.country, target.locale).catch(() => []);
    if (!stores.some((s) => s.key === next.collectionStoreKey)) delete next.collectionStoreKey;
  }

  const body = {
    country: target.country, currency: target.currency, locale: target.locale,
    cartCarriedOver, droppedLines, droppedCodes,
  };
  const res = setSessionCookie(NextResponse.json(body), await createSessionToken(next));
  return setMarketCookie(res, target.locale as LocaleKey);
});

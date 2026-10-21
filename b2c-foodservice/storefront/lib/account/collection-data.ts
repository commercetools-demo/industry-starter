import 'server-only';
import { getPromiseFigures } from '@/lib/ct/promise';
import { getMarket, getSession } from '@/lib/session';
import type { Money } from '@/lib/types';
import { marketForCountry } from '@/lib/utils';

/**
 * What the Collection tab needs from the server: whether the market has collection (US only, D-035) and the free-shipping
 * threshold of the promise figures (never a constant; null when the figure is unavailable, and the tile is then hidden).
 */
export async function loadCollectionFigures(): Promise<{ collection: boolean; freeShippingThreshold: Money | null }> {
  const [session, market] = await Promise.all([getSession(), getMarket()]);
  const collection = marketForCountry(market.country)?.collection ?? false;
  if (!collection) return { collection, freeShippingThreshold: null };
  const figures = await getPromiseFigures(market, session.collectionStoreKey);
  return { collection, freeShippingThreshold: figures.freeShippingThreshold };
}

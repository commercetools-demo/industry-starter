import 'server-only';
import { getStoresForCountry } from '@/lib/ct/channels';
import { getFreeShippingThreshold } from '@/lib/ct/shipping';
import { RETURN_DAYS } from '@/lib/shop-config';
import type { PromiseFigures } from '@/lib/types';
import { marketForCountry } from '@/lib/utils';

/**
 * Figures for the promise bar. Each part fails on its own: a missing figure is null and the bar drops that clause.
 * Collection minutes: the chosen store's, else the smallest across the market's stores, else null. A market without
 * collection (Canada, D-035) never has the clause.
 */
export async function getPromiseFigures(
  market: { country: string; currency: string; locale: string },
  collectionStoreKey?: string,
): Promise<PromiseFigures> {
  const collection = marketForCountry(market.country)?.collection ?? false;
  const [threshold, stores] = await Promise.all([
    getFreeShippingThreshold(market.country, market.currency).catch((e: unknown) => {
      console.error(JSON.stringify({ event: 'promise_threshold_failed', status: (e as { statusCode?: number })?.statusCode }));
      return null;
    }),
    collection
      ? getStoresForCountry(market.country, market.locale).catch(() => [])
      : Promise.resolve([]),
  ]);
  let collectionMinutes: number | null = null;
  if (collection && stores.length > 0) {
    const chosen = stores.find((s) => s.key === collectionStoreKey);
    collectionMinutes = chosen ? chosen.collectionMinutes : Math.min(...stores.map((s) => s.collectionMinutes));
  }
  return { freeShippingThreshold: threshold, collectionMinutes, returnDays: RETURN_DAYS };
}

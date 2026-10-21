import 'server-only';
import { getCategoryTree } from '@/lib/ct/categories';
import { getStoresForCountry } from '@/lib/ct/channels';
import { getValidCountryConfig } from '@/lib/ct/market';
import { getPromiseFigures } from '@/lib/ct/promise';
import { getSession } from '@/lib/session';
import type { Category, MarketOption, PromiseFigures, Store } from '@/lib/types';
import { marketForLocale } from '@/lib/utils';

export interface ShellData {
  country: string;
  currency: string;
  categories: Category[];
  figures: PromiseFigures;
  stores: Store[];
  selectedKey: string | null;
  markets: MarketOption[];
}

/**
 * Everything the shell needs for one request, read in parallel. Each part degrades alone: a failed call gives an empty
 * list or a missing figure and a server log line, and the shell still renders (it never throws).
 * The URL's market drives what is shown; the session supplies only the chosen store.
 */
export async function getShellData(locale: string): Promise<ShellData> {
  const market = marketForLocale(locale);
  const session = await getSession();
  const [categories, figures, stores, markets] = await Promise.all([
    getCategoryTree(locale).catch((e: unknown) => {
      console.error(JSON.stringify({ event: 'shell_categories_failed', status: (e as { statusCode?: number })?.statusCode }));
      return [] as Category[];
    }),
    getPromiseFigures(market, session.collectionStoreKey),
    market.collection
      ? getStoresForCountry(market.country, locale).catch((e: unknown) => {
          console.error(JSON.stringify({ event: 'shell_stores_failed', status: (e as { statusCode?: number })?.statusCode }));
          return [] as Store[];
        })
      : Promise.resolve([] as Store[]),
    getValidCountryConfig(),
  ]);
  const selectedKey = stores.some((s) => s.key === session.collectionStoreKey)
    ? (session.collectionStoreKey ?? null)
    : null;
  return { country: market.country, currency: market.currency, categories, figures, stores, selectedKey, markets };
}

import 'server-only';
import { getPromiseFigures } from '@/lib/ct/promise';
import { getFeaturedProduct, getHomeStore, getHomeTree, type HomeCtx } from '@/lib/home-data';
import { getSession } from '@/lib/session';
import type { Category, ProductSummary, PromiseFigures, Store } from '@/lib/types';
import { marketForLocale } from '@/lib/utils';

export interface HomePageData {
  ctx: HomeCtx;
  collection: boolean;
  tree: Category[];
  store: Store | null;
  figures: PromiseFigures;
  featured: ProductSummary | null;
}

/**
 * What the page needs before it can render the hero, tiles and banner (products stream later, in their own Suspense
 * boundaries). The session is read once; an invalid or expired token is an empty session, so the page renders as for an
 * anonymous visitor. Never throws: every part degrades alone (lib/home-data.ts, getPromiseFigures).
 */
export async function loadHomePage(locale: string): Promise<HomePageData> {
  const market = marketForLocale(locale);
  const session = await getSession();
  const ctx: HomeCtx = {
    locale,
    country: market.country,
    currency: market.currency,
    ...(session.collectionStoreKey ? { collectionStoreKey: session.collectionStoreKey } : {}),
  };
  const [tree, store, figures] = await Promise.all([
    getHomeTree(ctx),
    getHomeStore(ctx),
    getPromiseFigures(market, session.collectionStoreKey),
  ]);
  const featured = await getFeaturedProduct(ctx, tree, store);
  return { ctx, collection: market.collection, tree, store, figures, featured };
}

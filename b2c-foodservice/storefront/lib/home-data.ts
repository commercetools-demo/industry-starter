import 'server-only';
import { HOME_CONTENT } from '@/content/home';
import { idByKey, rootCategoryName } from '@/lib/category-tree';
import { getCategoryTree } from '@/lib/ct/categories';
import { getChannelByKey } from '@/lib/ct/channels';
import { getProductSummaryByKey } from '@/lib/ct/home-products';
import { getListingProjections } from '@/lib/ct/products';
import { searchProducts } from '@/lib/ct/search';
import { parseListingParams } from '@/lib/search/params';
import type { Category, ProductSummary, Store } from '@/lib/types';
import { marketForLocale } from '@/lib/utils';

/**
 * Data of the home page (workstream O, D5). Every function is its own section: it catches its own failure, logs one line
 * (`home_section_failed`, the section and the HTTP status, never a body) and returns the empty value, so one failing
 * section never blocks the page. Products and prices are never cached (per market and shopper); only the category tree
 * and the channel list are (by their own modules).
 */
export interface HomeCtx {
  locale: string;
  country: string;
  currency: string;
  /** Chosen store from the session (may be stale or unknown). */
  collectionStoreKey?: string;
}

export const HOME_PRODUCT_LIMIT = 4;

/** Runs one section; a failure is logged and gives `empty`. */
export async function section<T>(name: string, run: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await run();
  } catch (e) {
    console.error(JSON.stringify({ event: 'home_section_failed', section: name, status: (e as { statusCode?: number })?.statusCode }));
    return empty;
  }
}

export const getHomeTree = (ctx: HomeCtx): Promise<Category[]> =>
  section('tree', () => getCategoryTree(ctx.locale), [] as Category[]);

/** The session's store when it exists in this market's channel list; null in a market without collection. */
export function getHomeStore(ctx: HomeCtx): Promise<Store | null> {
  const key = ctx.collectionStoreKey;
  if (!key || !marketForLocale(ctx.locale).collection) return Promise.resolve(null);
  return section('store', async () => {
    const store = await getChannelByKey(key, ctx.locale);
    return store && store.country === ctx.country ? store : null;
  }, null);
}

const cardContext = (ctx: HomeCtx, tree: Category[], store: Store | null) => ({
  locale: ctx.locale,
  country: ctx.country,
  currency: ctx.currency,
  ...(store ? { storeChannelId: store.id } : {}),
  categoryName: (ids: string[]) => rootCategoryName(tree, ids),
});

/** The hero's featured product; null when the key is unset, unpublished or the call fails. */
export function getFeaturedProduct(ctx: HomeCtx, tree: Category[], store: Store | null): Promise<ProductSummary | null> {
  const key = HOME_CONTENT.hero.featuredProductKey;
  if (!key) return Promise.resolve(null);
  return section('featured', () => getProductSummaryByKey(key, cardContext(ctx, tree, store)), null);
}

/** Up to four products carrying the badge (`bestseller` or `new`), in the listing's default order. */
export function searchHomeProducts(
  collection: 'bestseller' | 'new',
  ctx: HomeCtx,
  tree: Category[],
  store: Store | null,
): Promise<ProductSummary[]> {
  return section(collection, async () => {
    const params = parseListingParams({ f_collection: collection }, 'shop');
    const outcome = await searchProducts(
      { locale: ctx.locale, currency: ctx.currency, country: ctx.country, ...(store ? { storeChannelId: store.id } : {}) },
      { categoryIdByKey: idByKey(tree) },
      params,
      { limit: HOME_PRODUCT_LIMIT, withFacets: false },
    );
    if (outcome.status !== 'ok' || outcome.ids.length === 0) return [];
    return getListingProjections(outcome.ids, cardContext(ctx, tree, store));
  }, [] as ProductSummary[]);
}

/** How many products can be subscribed to: one result, total only. 0 on failure. */
export function countSubscribable(ctx: HomeCtx): Promise<number> {
  return section('subscribable', async () => {
    const params = parseListingParams({ f_collection: 'subscribable' }, 'shop');
    const outcome = await searchProducts(
      { locale: ctx.locale, currency: ctx.currency, country: ctx.country },
      {},
      params,
      { limit: 1, withFacets: false },
    );
    return outcome.status === 'ok' ? outcome.total : 0;
  }, 0);
}

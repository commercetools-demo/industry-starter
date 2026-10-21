import 'server-only';
import { findCategory, idByKey, rootCategoryName } from '@/lib/category-tree';
import { getCategoryTree } from '@/lib/ct/categories';
import { getStoresForCountry } from '@/lib/ct/channels';
import { getListingProjections } from '@/lib/ct/products';
import { searchProducts } from '@/lib/ct/search';
import { machineTakesCapsules } from '@/lib/product/compatibility';
import { PODS_CATEGORY_KEY } from '@/lib/product/variant-config';
import { parseListingParams } from '@/lib/search/params';
import { getSession } from '@/lib/session';
import type { ProductDetail, ProductSummary } from '@/lib/types';
import { marketForLocale } from '@/lib/utils';

export const RELATED_COUNT = 4;
export const GOES_WITH_COUNT = 4;

export interface RelatedContext { locale: string; country: string; currency: string; storeChannelId?: string }

/** Ids from a search, in order, without duplicates and without the product itself. */
async function idsFor(
  ctx: RelatedContext,
  scope: { categoryId?: string },
  facets: Record<string, string>,
  limit: number,
  tree: Awaited<ReturnType<typeof getCategoryTree>>,
): Promise<string[]> {
  const params = parseListingParams(Object.fromEntries(Object.entries(facets).map(([k, v]) => [`f_${k}`, v])), 'category');
  const out = await searchProducts(ctx, { ...scope, categoryIdByKey: idByKey(tree) }, params, { limit, withFacets: false });
  return out.status === 'ok' ? out.ids : [];
}

/**
 * "You may also like" (workstream H, 3.9): always up to four cards. First the deepest category of the product (limit 5, the
 * product dropped), then its root category (limit 8) merged without duplicates, then the bestsellers fill the rest. Uses the
 * listing's market filter and card mapper. Failures are the caller's to catch (the strip is omitted). Exported for O.
 */
export async function getRelatedProducts(product: Pick<ProductDetail, 'id' | 'breadcrumb'>, ctx: RelatedContext): Promise<ProductSummary[]> {
  const tree = await getCategoryTree(ctx.locale);
  const chosen: string[] = [];
  const take = (ids: string[]) => {
    for (const id of ids) if (id !== product.id && !chosen.includes(id) && chosen.length < RELATED_COUNT) chosen.push(id);
  };
  const deepest = product.breadcrumb.at(-1);
  const root = product.breadcrumb[0];
  if (deepest) take(await idsFor(ctx, { categoryId: deepest.id }, {}, 5, tree));
  if (chosen.length < RELATED_COUNT && root && root.id !== deepest?.id) take(await idsFor(ctx, { categoryId: root.id }, {}, 8, tree));
  if (chosen.length < RELATED_COUNT) take(await idsFor(ctx, {}, { collection: 'bestseller' }, RELATED_COUNT + 2, tree));
  return getListingProjections(chosen, { ...ctx, categoryName: (ids) => rootCategoryName(tree, ids) });
}

/**
 * Capsules that fit a machine: pods whose `system` equals the machine's, up to four. Only for systems that take capsules
 * (Original and Vertuo, Q-H-13); other machines get an empty list. Exported for O and for K (starter bundles).
 */
export async function getCompatibleCapsules(product: Pick<ProductDetail, 'shape' | 'systemKey'>, ctx: RelatedContext): Promise<ProductSummary[]> {
  if (product.shape !== 'machine' || !product.systemKey || !machineTakesCapsules(product.systemKey)) return [];
  const tree = await getCategoryTree(ctx.locale);
  const pods = findCategory(tree, (c) => c.key === PODS_CATEGORY_KEY);
  if (!pods) return [];
  const ids = await idsFor(ctx, { categoryId: pods.id }, { system: product.systemKey }, GOES_WITH_COUNT, tree);
  return getListingProjections(ids, { ...ctx, categoryName: (found) => rootCategoryName(tree, found) });
}

/** Market, currency and the chosen store's channel id for the cards' availability line, from the URL locale and the session. */
export async function getRelatedContext(locale: string): Promise<RelatedContext> {
  const market = marketForLocale(locale);
  const session = await getSession();
  let storeChannelId: string | undefined;
  if (market.collection && session.collectionStoreKey) {
    const stores = await getStoresForCountry(market.country, locale).catch(() => []);
    storeChannelId = stores.find((s) => s.key === session.collectionStoreKey)?.id;
  }
  return { locale, country: market.country, currency: market.currency, ...(storeChannelId ? { storeChannelId } : {}) };
}

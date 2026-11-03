import 'server-only';
import type { ProductSearchRequest } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { cachedPublic } from '@/lib/ct/public-cache';
import { DEFAULT_BRAND, isBrandSlug, type BrandSlug } from '@/lib/brands';
import { findCategory, pruneToIds } from '@/lib/category-tree';
import { getSelectionId } from '@/lib/ct/product-selections';
import { selectionClause } from '@/lib/search/build';
import { buildCategoryTree, mapCategory } from '@/lib/mappers/category';
import type { Category } from '@/lib/types';

/**
 * Ids of the categories that hold at least one product of the brand's selection, with their ancestors (the `categoriesSubTree`
 * facet of a no-hits Product Search query). null when the selection is missing from the project.
 */
async function brandCategoryIds(brand: BrandSlug): Promise<Set<string> | null> {
  const selectionId = await getSelectionId(brand);
  if (!selectionId) return null;
  const res = await apiRoot.products().search().post({
    body: {
      query: selectionClause(selectionId), limit: 0,
      facets: [{ distinct: { name: 'categories', field: 'categoriesSubTree', fieldType: 'text', limit: 500, level: 'products' } }],
    } as unknown as ProductSearchRequest,
  }).execute();
  const facets = (res.body as unknown as { facets?: { name: string; buckets?: { key: string }[] }[] }).facets ?? [];
  return new Set((facets.find((f) => f.name === 'categories')?.buckets ?? []).map((b) => String(b.key)));
}

async function fetchCategoryTree(locale: string, brand: string): Promise<Category[]> {
  const scope = isBrandSlug(brand) ? brand : undefined;
  const [{ body }, ids] = await Promise.all([
    apiRoot.categories().get({ queryArgs: { limit: 500, sort: ['orderHint asc'] } }).execute(),
    scope ? brandCategoryIds(scope) : Promise.resolve(null),
  ]);
  const tree = buildCategoryTree(body.results.map((c) => mapCategory(c, locale)));
  // A brand without a selection in the project: the default brand keeps the whole tree, any other brand has no categories.
  if (!scope) return tree;
  if (!ids) return scope === DEFAULT_BRAND ? tree : [];
  return pruneToIds(tree, ids);
}

/**
 * The category tree for a locale, roots first, children by order hint. Public data cached 60 s (tag `categories`).
 * Added by workstream F for the mega menu; workstream G extends this file (breadcrumbs, lookups), it does not replace it.
 */
const cachedTree: (locale: string, brand: string) => Promise<Category[]> = cachedPublic('categories', ['category-tree'], fetchCategoryTree);

/** Without a brand: every category (account pages, shared content). With a brand: only the categories of the brand's selection. */
export function getCategoryTree(locale: string, brand?: BrandSlug): Promise<Category[]> {
  return cachedTree(locale, brand ?? '');
}

/** Category by its locale slug, from the cached tree (no extra call). null when unknown. Added by workstream G. */
export async function getCategoryBySlug(locale: string, slug: string, brand?: BrandSlug): Promise<Category | null> {
  return findCategory(await getCategoryTree(locale, brand), (c) => c.slug === slug);
}

/** Category by key (the `category` facet value, e.g. `mcf-cat-pods-original`). */
export async function getCategoryByKey(locale: string, key: string, brand?: BrandSlug): Promise<Category | null> {
  return findCategory(await getCategoryTree(locale, brand), (c) => c.key === key);
}

export { breadcrumbOf } from '@/lib/category-tree';

import 'server-only';
import { apiRoot } from '@/lib/ct/client';
import { cachedPublic } from '@/lib/ct/public-cache';
import { buildCategoryTree, mapCategory } from '@/lib/mappers/category';
import type { Category } from '@/lib/types';

async function fetchCategoryTree(locale: string): Promise<Category[]> {
  const { body } = await apiRoot
    .categories()
    .get({ queryArgs: { limit: 500, sort: ['orderHint asc'] } })
    .execute();
  return buildCategoryTree(body.results.map((c) => mapCategory(c, locale)));
}

/**
 * The category tree for a locale, roots first, children by order hint. Public data cached 60 s (tag `categories`).
 * Added by workstream F for the mega menu; workstream G extends this file (breadcrumbs, lookups), it does not replace it.
 */
export const getCategoryTree: (locale: string) => Promise<Category[]> = cachedPublic(
  'categories',
  ['category-tree'],
  fetchCategoryTree,
);

import 'server-only';
import { unstable_cache } from 'next/cache';
import { apiRoot } from '@/lib/ct/client';
import { mapCategoryTree } from '@/lib/mappers/category';
import type { Category } from '@/lib/types';

/** TTL (seconds) of the public category tree cache. */
export const CATEGORY_TREE_REVALIDATE_SECONDS = 60;

async function fetchCategoryTree(): Promise<Category[]> {
  const { body } = await apiRoot.categories().get({ queryArgs: { limit: 500, sort: 'orderHint asc' } }).execute();
  return mapCategoryTree(body.results);
}

/** The whole category tree, nested. Identical for every visitor, so cached 60 s. */
export const getCategoryTree = unstable_cache(fetchCategoryTree, ['ct-category-tree'], {
  revalidate: CATEGORY_TREE_REVALIDATE_SECONDS,
});

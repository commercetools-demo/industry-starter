import 'server-only';
import { unstable_cache } from 'next/cache';
import { CATEGORY_TREE_TTL } from '@/lib/config/cache';
import { buildCategoryTree, findCategoryBySlug, flattenTree, mapCategory, type CategorySlugMatch } from '@/lib/mappers/category';
import type { Category, Locale } from '@/lib/types';
import { getApiRoot } from './client';
import { withTimeout } from './timeout';

/** The whole tree in one call (walked in memory, never per level); cached for CATEGORY_TREE_TTL. No session data inside. */
export async function getCategoryTree(locale: Locale): Promise<Category[]> {
  const read = unstable_cache(
    async (): Promise<Category[]> => {
      const { body } = await withTimeout(getApiRoot().categories().get({ queryArgs: { limit: 500 } }).execute(), 'categories.tree');
      return buildCategoryTree(body.results.map((category) => mapCategory(category, locale)));
    },
    ['category-tree', locale],
    { revalidate: CATEGORY_TREE_TTL, tags: ['catalog'] },
  );
  return read();
}

/** The slug of `locale` first, then a slug of any other locale (`matchedLocale` tells the page to redirect to the canonical slug). */
export async function getCategoryBySlug(slug: string, locale: Locale): Promise<CategorySlugMatch | null> {
  return findCategoryBySlug(await getCategoryTree(locale), slug, locale);
}

export async function getCategoryByKey(key: string, locale: Locale): Promise<Category | null> {
  return flattenTree(await getCategoryTree(locale)).find((category) => category.key === key) ?? null;
}

import 'server-only';
import { unstable_cache } from 'next/cache';
import type { Category as SdkCategory } from '@commercetools/platform-sdk';
import { buildCategoryTree } from '../mappers/category';
import type { Category } from '../types';
import { getApiRoot } from './client';

export const CATEGORY_TREE_REVALIDATE_SECONDS = 60;
const PAGE = 500;

async function fetchAllCategories(): Promise<SdkCategory[]> {
  const root = getApiRoot();
  const all: SdkCategory[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { body } = await root.categories().get({ queryArgs: { limit: PAGE, offset, sort: 'orderHint asc' } }).execute();
    all.push(...body.results);
    if (all.length >= (body.total ?? 0) || body.results.length === 0) return all;
  }
}

/**
 * Public, stable data only: cached for 60 s per locale and shared across users, so nothing here may read the session.
 */
export async function getCategoryTree(locale: string): Promise<Category[]> {
  const cached = unstable_cache(async () => buildCategoryTree(await fetchAllCategories(), locale), ['category-tree', locale], {
    revalidate: CATEGORY_TREE_REVALIDATE_SECONDS,
  });
  return cached();
}

function find(tree: Category[], slug: string): Category | null {
  for (const node of tree) {
    if (node.slug === slug) return node;
    const inChildren = node.children ? find(node.children, slug) : null;
    if (inChildren) return inChildren;
  }
  return null;
}

/** Exact slug match in the locale's slug, taken from the cached tree. */
export async function getCategoryBySlug(slug: string, locale: string): Promise<Category | null> {
  return find(await getCategoryTree(locale), slug);
}

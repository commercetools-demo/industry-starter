// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import 'server-only';
import type { Category } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { createTtlCache } from '@/lib/ttl-cache';
import type { ListingCategory, NavCategory } from '@/lib/types';
import { getLocalizedString } from '@/lib/utils';

const cache = createTtlCache<NavCategory[]>({ ttlMs: 300_000, negativeTtlMs: 30_000 });

export async function rootCategories(): Promise<Category[]> {
  const { body } = await apiRoot.categories().get({ queryArgs: { where: 'parent is not defined', sort: 'orderHint asc', limit: 50 } }).execute();
  return body.results;
}

/** Ids of root categories that have at least one product of the store in their subtree: one facet call. */
async function rootsWithProductsByFacet(storeId: string): Promise<Set<string>> {
  const { body } = await apiRoot
    .products()
    .search()
    .post({
      body: {
        query: { exact: { field: 'stores', value: storeId } },
        facets: [{ distinct: { name: 'roots', field: 'categoriesSubTree', limit: 50 } }],
        limit: 0,
      },
    })
    .execute();
  const facet = body.facets?.find((f) => f.name === 'roots') as { buckets?: { key: string; count: number }[] } | undefined;
  if (!facet?.buckets) throw new Error('facet missing');
  return new Set(facet.buckets.filter((b) => b.count > 0).map((b) => b.key));
}

/** Fallback when the facet is unsupported: one search per root with `exact categoriesSubTree` and `limit: 1`. */
async function rootsWithProductsBySearch(storeId: string, roots: Category[]): Promise<Set<string>> {
  const found = await Promise.all(
    roots.map(async (root) => {
      const { body } = await apiRoot
        .products()
        .search()
        .post({ body: { query: { and: [{ exact: { field: 'stores', value: storeId } }, { exact: { field: 'categoriesSubTree', value: root.id } }] }, limit: 1 } })
        .execute();
      return body.total > 0 ? root.id : null;
    }),
  );
  return new Set(found.filter((id): id is string => id !== null));
}

/**
 * First-level categories of the store's assortment in order-hint order: a root is kept only when at least one product of
 * the store is in its subtree. Cached 5 minutes per store and locale. A failure serves the last known list, else an empty one.
 */
export async function getNavCategories(storeId: string, locale: string): Promise<NavCategory[]> {
  const key = `${storeId}:${locale}`;
  const hit = cache.get(key);
  if (hit?.value) return hit.value;
  try {
    const roots = await rootCategories();
    let keep: Set<string>;
    try {
      keep = await rootsWithProductsByFacet(storeId);
    } catch {
      keep = await rootsWithProductsBySearch(storeId, roots);
    }
    const list = roots
      .filter((c) => keep.has(c.id))
      .map((c) => ({ id: c.id, slug: getLocalizedString(c.slug, locale), name: getLocalizedString(c.name, locale) }))
      .filter((c) => c.slug && c.name);
    cache.set(key, list);
    return list;
  } catch {
    console.error('[nav] categories could not be read');
    return cache.getStale(key)?.value ?? [];
  }
}

// ---- Category pages (workstream L) ----

const SLUG = /^[a-z0-9][a-z0-9-]{0,255}$/;
const categoryCache = createTtlCache<ListingCategory>({ ttlMs: 300_000, negativeTtlMs: 30_000 });

/**
 * A category by its localized slug with ancestors (root first) for the breadcrumb; `null` for an unknown slug. Categories are
 * shared by all shoppers: cached 5 minutes per slug and locale (negative entries 30 s). An outage serves the last known entry.
 */
export async function getCategoryBySlug(slug: string, locale: string): Promise<ListingCategory | null> {
  if (!SLUG.test(slug)) return null;
  const key = `${locale}:${slug}`;
  const hit = categoryCache.get(key);
  if (hit) return hit.value;
  try {
    const { body } = await apiRoot
      .categories()
      .get({ queryArgs: { where: `slug(${locale}="${slug}")`, expand: ['ancestors[*]'], limit: 1 } })
      .execute();
    const found = body.results[0];
    if (!found) {
      categoryCache.set(key, null);
      return null;
    }
    const ancestors = (found.ancestors ?? [])
      .map((a) => a.obj)
      .filter((c): c is Category => c !== undefined)
      .map((c) => ({ id: c.id, slug: getLocalizedString(c.slug, locale), name: getLocalizedString(c.name, locale) }));
    const category = { id: found.id, slug: getLocalizedString(found.slug, locale), name: getLocalizedString(found.name, locale), ancestors };
    categoryCache.set(key, category);
    return category;
  } catch (error) {
    const stale = categoryCache.getStale(key);
    if (stale) return stale.value;
    throw error;
  }
}

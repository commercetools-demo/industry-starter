// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Whole-catalog reads of the Malva level pages (change add-malva-home): the category navigation and the listing. No store,
// price, channel or inventory scope: the products are the master catalog, the card model has no commerce data (D3, D4).
import 'server-only';
import type { ProductProjection, ProductSearchRequest } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { rootCategories } from '@/lib/ct/categories';
import { mapMalvaSummary } from '@/lib/mappers/malva';
import type { MalvaListingResult } from '@/lib/malva-types';
import { buildMalvaSearchRequest } from '@/lib/search/build';
import { PAGE_SIZE, type ListingParams } from '@/lib/search/params';
import { createTtlCache } from '@/lib/ttl-cache';
import type { NavCategory } from '@/lib/types';
import { getLocalizedString } from '@/lib/utils';

export { mapMalvaSummary };

const cache = createTtlCache<NavCategory[]>({ ttlMs: 300_000, negativeTtlMs: 30_000 });
const PRODUCT_ID = /^[A-Za-z0-9-]{1,64}$/;

/** Ids of root categories that have at least one product in their subtree: one facet call. */
async function rootsWithProductsByFacet(): Promise<Set<string>> {
  const { body } = await apiRoot
    .products()
    .search()
    .post({ body: { facets: [{ distinct: { name: 'roots', field: 'categoriesSubTree', limit: 50 } }], limit: 0 } })
    .execute();
  const facet = body.facets?.find((f) => f.name === 'roots') as { buckets?: { key: string; count: number }[] } | undefined;
  if (!facet?.buckets) throw new Error('facet missing');
  return new Set(facet.buckets.filter((b) => b.count > 0).map((b) => b.key));
}

/** Fallback when the facet is unsupported: one search per root with `exact categoriesSubTree` and `limit: 1`. */
async function rootsWithProductsBySearch(rootIds: string[]): Promise<Set<string>> {
  const found = await Promise.all(
    rootIds.map(async (id) => {
      const { body } = await apiRoot
        .products()
        .search()
        .post({ body: { query: { exact: { field: 'categoriesSubTree', value: id } }, limit: 1 } })
        .execute();
      return body.total > 0 ? id : null;
    }),
  );
  return new Set(found.filter((id): id is string => id !== null));
}

/**
 * First-level categories of the whole master catalog in order-hint order: a root is kept only when at least one product is in
 * its subtree. Cached 5 minutes per locale. A failure serves the last known list, else an empty one.
 */
export async function getMalvaNavCategories(locale: string): Promise<NavCategory[]> {
  const hit = cache.get(locale);
  if (hit?.value) return hit.value;
  try {
    const roots = await rootCategories();
    let keep: Set<string>;
    try {
      keep = await rootsWithProductsByFacet();
    } catch {
      keep = await rootsWithProductsBySearch(roots.map((c) => c.id));
    }
    const list = roots
      .filter((c) => keep.has(c.id))
      .map((c) => ({ id: c.id, slug: getLocalizedString(c.slug, locale), name: getLocalizedString(c.name, locale) }))
      .filter((c) => c.slug && c.name);
    cache.set(locale, list);
    return list;
  } catch {
    console.error('[malva] nav categories could not be read');
    return cache.getStale(locale)?.value ?? [];
  }
}

export interface MalvaSearchInput {
  locale: string;
  params: ListingParams;
  /** The category whose subtree is listed; the whole catalog without it. */
  categoryId?: string;
  /** The active vehicle's range keys (`getActiveVehicle().fitKeys`), null without a vehicle. */
  fitKeys: string[] | null;
}

/**
 * One page of the Malva listing: Product Search over the whole catalog (ids, facets, total), then the projections of the page's
 * ids in that order. No price argument, store, channel or inventory is sent, and the card model has no field for them.
 */
export async function searchMalvaProducts({ locale, params, categoryId, fitKeys }: MalvaSearchInput): Promise<MalvaListingResult> {
  const request = buildMalvaSearchRequest({ locale, fitKeys }, { categoryId }, params);
  const { body } = await apiRoot
    .products()
    .search()
    .post({ body: request as ProductSearchRequest })
    .execute();
  const ids = body.results.map((r) => r.id);
  for (const id of ids) if (!PRODUCT_ID.test(id)) throw new Error('Invalid product id');

  let projections: ProductProjection[] = [];
  if (ids.length > 0) {
    const projected = await apiRoot
      .productProjections()
      .get({ queryArgs: { where: `id in (${ids.map((i) => `"${i}"`).join(',')})`, localeProjection: [locale], limit: ids.length } })
      .execute();
    const byId = new Map(projected.body.results.map((p) => [p.id, p]));
    projections = ids.map((id) => byId.get(id)).filter((p): p is ProductProjection => p !== undefined);
  }

  const facets: MalvaListingResult['facets'] = [];
  for (const f of body.facets ?? []) {
    const buckets = (f as { buckets?: { key: string; count: number }[] }).buckets;
    if (buckets) facets.push({ name: f.name, buckets: buckets.map((b) => ({ key: b.key, count: b.count })) });
  }
  return {
    items: projections.map((p) => mapMalvaSummary(p, locale)),
    total: body.total,
    page: params.page,
    totalPages: Math.max(1, Math.ceil(body.total / PAGE_SIZE)),
    facets,
  };
}

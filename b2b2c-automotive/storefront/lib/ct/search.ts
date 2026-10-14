// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The listing's Product Search calls (workstream L; K and M reuse `searchParts` for popular blocks and related parts).
// Search returns ids, facets and the total only (D2): cards are built from `getListingProjections` (lib/ct/products.ts).
import 'server-only';
import type { ProductSearchRequest } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { buildExactPartRequest, buildSearchRequest, isPartNumberLike, type ListingScope, type SearchContext, type SearchRequest } from '@/lib/search/build';
import { PAGE_SIZE, type ListingParams } from '@/lib/search/params';

export interface FacetResult {
  name: string;
  buckets: { key: string; count: number }[];
}
export interface SearchPartsResult {
  /** Product ids of this page in display order (at most one page). */
  ids: string[];
  total: number;
  facets: FacetResult[];
}

async function run(request: SearchRequest) {
  const { body } = await apiRoot
    .products()
    .search()
    .post({ body: request as ProductSearchRequest })
    .execute();
  return body;
}

/**
 * One listing page. On page 1 of a part-number-like query the exact part or OE number matches (which ignore the fit scope,
 * Q-L02, but honour the other filters) are put first and removed from the rest. The total counts an exact match once: it
 * adds to the total only when the fit scope is on and the main result is complete (so the exact part is certainly not in it).
 */
export async function searchParts(ctx: SearchContext, scope: ListingScope, p: ListingParams): Promise<SearchPartsResult> {
  const main = await run(buildSearchRequest(ctx, scope, p));
  let ids = main.results.map((r) => r.id);
  let total = main.total;

  const exactRequest = p.page === 1 && p.q && isPartNumberLike(p.q) ? buildExactPartRequest(ctx, p.q, p) : null;
  if (exactRequest) {
    const exactIds = (await run(exactRequest)).results.map((r) => r.id);
    const onPage = new Set(ids);
    const fitScopeOn = ctx.fitKeys !== null && p.fit;
    if (fitScopeOn && main.total <= ids.length) total += exactIds.filter((id) => !onPage.has(id)).length;
    ids = [...new Set([...exactIds, ...ids])].slice(0, PAGE_SIZE);
  }

  const facets: FacetResult[] = [];
  for (const f of main.facets ?? []) {
    const buckets = (f as { buckets?: { key: string; count: number }[] }).buckets;
    if (buckets) facets.push({ name: f.name, buckets: buckets.map((b) => ({ key: b.key, count: b.count })) });
  }
  return { ids, total, facets };
}

/** Products of the store (and category subtree) without any shopper filter or fit scope: tells an empty category from an empty filter. */
export async function countAssortment(ctx: SearchContext, scope: ListingScope): Promise<number> {
  const request = buildSearchRequest({ ...ctx, fitKeys: null }, scope, { sort: 'popular', sortGiven: false, page: 1, fit: true, brand: [], pickup: false, attrs: {} });
  const { total } = await run({ query: request.query, limit: 0, offset: 0 });
  return total;
}

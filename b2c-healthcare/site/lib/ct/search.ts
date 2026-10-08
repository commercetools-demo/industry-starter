import 'server-only';
import type { ProductProjection, ProductSearchFacetResult } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { buildSearchRequest, type SearchParams } from '@/lib/ct/search-query';

export interface FacetBucket {
  value: string;
  count: number;
}
export interface FacetResult {
  name: string;
  buckets: FacetBucket[];
}
export interface SearchPage<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  facets: FacetResult[];
}

function mapFacet(facet: ProductSearchFacetResult): FacetResult | undefined {
  const buckets = (facet as { buckets?: { key: string; count: number }[] }).buckets;
  if (!buckets) return undefined;
  return { name: facet.name, buckets: buckets.map((b) => ({ value: b.key, count: b.count })) };
}

/**
 * Thin Product Search wrapper (never the legacy projections search endpoint). Not cached: results depend
 * on the visitor's query, currency and price channel. `mapItem` converts the SDK projection to an
 * app type so no SDK type leaves lib/ct (see lib/mappers/*).
 */
export async function searchProducts<T>(
  params: SearchParams,
  mapItem: (projection: ProductProjection) => T,
): Promise<SearchPage<T>> {
  const { body } = await apiRoot.products().search().post({ body: buildSearchRequest(params) }).execute();
  const items: T[] = [];
  for (const result of body.results) {
    if (result.productProjection) items.push(mapItem(result.productProjection));
  }
  return {
    items,
    total: body.total,
    offset: body.offset,
    limit: body.limit,
    facets: (body.facets ?? []).map(mapFacet).filter((f): f is FacetResult => f !== undefined),
  };
}

import 'server-only';
import type { ListingFacets, SearchResult } from '../types';
import { searchProducts, type SearchParams } from './search';

export interface ListingResult extends SearchResult {
  /** Facets where each group ignores its own filter (disjunctive facets). */
  facets: ListingFacets;
  /** Products matching the price and availability filters but not the category filter. */
  categoryTotal: number;
}

/**
 * One search for the page of products plus, only for the filters that are active, one lean search without that filter
 * so its counts show what each choice would give. All searches start at once (the default listing needs just one).
 */
export async function loadListing(params: SearchParams): Promise<ListingResult> {
  const lean = { pageSize: 1, page: 1, sort: undefined };
  const [main, withoutCategory, withoutPrice, withoutStock] = await Promise.all([
    searchProducts(params),
    params.categoryId ? searchProducts({ ...params, ...lean, categoryId: undefined }) : undefined,
    params.priceBand ? searchProducts({ ...params, ...lean, priceBand: undefined }) : undefined,
    params.availability ? searchProducts({ ...params, ...lean, availability: undefined }) : undefined,
  ]);
  return {
    ...main,
    facets: {
      categories: (withoutCategory ?? main).facets.categories,
      priceBands: (withoutPrice ?? main).facets.priceBands,
      availability: (withoutStock ?? main).facets.availability,
    },
    categoryTotal: (withoutCategory ?? main).total,
  };
}

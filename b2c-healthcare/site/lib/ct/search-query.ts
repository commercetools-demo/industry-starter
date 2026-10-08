import 'server-only';
import type { ProductSearchFacetExpression, ProductSearchRequest, SearchSorting } from '@commercetools/platform-sdk';

/**
 * Pure builders for Product Search request objects (apiRoot.products().search().post({ body })).
 * Attribute names follow the seed data model (plans/SEED-PLAN.md): doctors have `specialty`, `city`,
 * `modes` (enum, searchable); medications have `rxOnly` (boolean, searchable).
 */

export const SEARCH_DEFAULT_PAGE_SIZE = 20;
export const SEARCH_MAX_PAGE_SIZE = 100;

export type SearchSort = 'relevance' | 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc';

export interface SearchFilters {
  /** Enum attribute keys (OR within one attribute, AND between attributes). */
  specialty?: string[];
  city?: string[];
  /** Consultation modes offered: `remote` and/or `office`. */
  modes?: string[];
  rxOnly?: boolean;
}

export interface SearchParams {
  text?: string;
  /** commercetools category id; matches the category and all its descendants. */
  categoryId?: string;
  filters?: SearchFilters;
  sort?: SearchSort;
  /** 1-based page number. */
  page?: number;
  pageSize?: number;
  /** BCP-47 locale for text matching and sorting. */
  locale: string;
  currency: string;
  country: string;
  /** Price channel id (`mlv-remote` / `mlv-office`) used for price selection of the projection. */
  priceChannelId?: string;
}

type Query = NonNullable<ProductSearchRequest['query']>;
type FilterExpression = NonNullable<
  Extract<Query, { filter: unknown }>['filter']
>[number];

const ENUM_FILTERS = ['specialty', 'city', 'modes'] as const;

/** Full-text match on the product name in the given language; every word must match. */
export function buildTextQuery(text: string, locale: string): Query {
  return { fullText: { field: 'name', language: locale, value: text.trim(), mustMatch: 'all' } };
}

/** Exact-match expressions for the facet selections (one per attribute, `values` for multi-select). */
export function buildFacetFilters(filters: SearchFilters = {}): FilterExpression[] {
  const out: FilterExpression[] = [];
  for (const name of ENUM_FILTERS) {
    const values = (filters[name] ?? []).filter((v) => v.length > 0);
    if (values.length > 0) {
      out.push({ exact: { field: `variants.attributes.${name}`, fieldType: 'enum', values } });
    }
  }
  if (typeof filters.rxOnly === 'boolean') {
    out.push({
      exact: { field: 'variants.attributes.rxOnly', fieldType: 'boolean', value: filters.rxOnly },
    });
  }
  return out;
}

/** Category plus facet filters plus text, combined with `and`. Undefined when nothing restricts. */
export function buildQuery(params: Pick<SearchParams, 'text' | 'categoryId' | 'filters' | 'locale'>): Query | undefined {
  const parts: Query[] = [];
  if (params.text && params.text.trim().length > 0) parts.push(buildTextQuery(params.text, params.locale));
  const filters: FilterExpression[] = [];
  if (params.categoryId) filters.push({ exact: { field: 'categoriesSubTree', value: params.categoryId } });
  filters.push(...buildFacetFilters(params.filters));
  if (filters.length > 0) parts.push({ filter: filters });
  if (parts.length === 0) return undefined;
  return parts.length === 1 ? parts[0] : { and: parts };
}

/** Sort definitions. Price sorting takes the lowest price of the product in the visitor's currency. */
export function buildSort(sort: SearchSort | undefined, locale: string, currency: string): SearchSorting[] | undefined {
  switch (sort) {
    case undefined:
    case 'relevance':
      return undefined;
    case 'name-asc':
    case 'name-desc':
      return [{ field: 'name', language: locale, order: sort === 'name-asc' ? 'asc' : 'desc' }];
    case 'price-asc':
    case 'price-desc':
      return [
        {
          field: 'variants.prices.centAmount',
          mode: sort === 'price-asc' ? 'min' : 'max',
          order: sort === 'price-asc' ? 'asc' : 'desc',
          filter: { exact: { field: 'variants.prices.currencyCode', value: currency } },
        },
      ];
  }
}

/** 1-based page -> limit/offset, clamped (page >= 1, 1 <= pageSize <= 100). */
export function buildPaging(page = 1, pageSize = SEARCH_DEFAULT_PAGE_SIZE): { limit: number; offset: number } {
  const size = Math.min(SEARCH_MAX_PAGE_SIZE, Math.max(1, Math.floor(pageSize)));
  const p = Math.max(1, Math.floor(page));
  return { limit: size, offset: (p - 1) * size };
}

/** Distinct-value facets for the listing filters; counts are per product. */
export function buildFacets(): ProductSearchFacetExpression[] {
  return ENUM_FILTERS.map((name) => ({
    distinct: { name, field: `variants.attributes.${name}`, fieldType: 'enum', level: 'products' },
  }));
}

/** The complete request body for `apiRoot.products().search().post({ body })`. */
export function buildSearchRequest(params: SearchParams): ProductSearchRequest {
  const { limit, offset } = buildPaging(params.page, params.pageSize);
  const query = buildQuery(params);
  const sort = buildSort(params.sort, params.locale, params.currency);
  return {
    ...(query ? { query } : {}),
    ...(sort ? { sort } : {}),
    facets: buildFacets(),
    limit,
    offset,
    productProjectionParameters: {
      priceCurrency: params.currency,
      priceCountry: params.country,
      ...(params.priceChannelId ? { priceChannel: params.priceChannelId } : {}),
      localeProjection: [params.locale],
    },
  };
}

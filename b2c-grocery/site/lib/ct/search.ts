import 'server-only';
import type {
  ProductPagedSearchResponse,
  ProductProjection,
  ProductSearchFacetResultBucket,
  ProductSearchFacetResultCount,
  ProductSearchRequest,
} from '@commercetools/platform-sdk';
import { getPriceBands, type PriceBand } from '../config/price-bands';
import { mapProduct } from '../mappers/product';
import type { ListingFacets, Product, SearchResult, SortKey } from '../types';
import { getApiRoot } from './client';

export interface Ctx { locale: string; currency: string; country: string }

export interface SearchParams extends Ctx {
  text?: string;
  categoryId?: string;
  priceBand?: string;
  availability?: 'in-stock' | 'out-of-stock';
  sort?: SortKey;
  page?: number;
  pageSize?: number;
}

export const DEFAULT_PAGE_SIZE = 24;
const MAX_CATEGORY_FACET_BUCKETS = 100;

type Expr = Record<string, unknown>;

/** Product Search field names verified against the live project (PROJECT-FINDINGS.md section 4). */
const FIELD = {
  name: 'name',
  categoriesSubTree: 'categoriesSubTree',
  categories: 'categories',
  createdAt: 'createdAt',
  priceAmount: 'variants.prices.centAmount',
  priceCurrency: 'variants.prices.currencyCode',
  priceCountry: 'variants.prices.country',
  onStock: 'variants.availability.isOnStock',
  sku: 'variants.sku',
  slug: 'slug',
  id: 'id',
} as const;

const and = (expressions: Expr[]): Expr => (expressions.length === 1 ? expressions[0] : { and: expressions });

/** Matches one price of the shopper's market. All three conditions must hold for the same price object. */
const priceScope = ({ currency, country }: Ctx): Expr[] => [
  { exact: { field: FIELD.priceCurrency, value: currency } },
  { exact: { field: FIELD.priceCountry, value: country } },
];

const priceRange = (band: PriceBand): Expr => ({
  range: {
    field: FIELD.priceAmount,
    ...(band.min !== undefined ? { gte: band.min } : {}),
    ...(band.max !== undefined ? { lt: band.max } : {}),
  },
});

const inStock: Expr = { exact: { field: FIELD.onStock, value: true } };
const outOfStock: Expr = { not: [inStock] };

function sortFor(key: SortKey | undefined, ctx: Ctx): Expr[] | undefined {
  switch (key) {
    case 'newest':
      return [{ field: FIELD.createdAt, order: 'desc' }];
    case 'price-asc':
    case 'price-desc':
      return [{ field: FIELD.priceAmount, order: key === 'price-asc' ? 'asc' : 'desc', mode: 'min', filter: and(priceScope(ctx)) }];
    default:
      return undefined; // relevance: omit sort
  }
}

/** Pure request builder: every listing and search path goes through here. */
export function buildSearchRequest(p: SearchParams): ProductSearchRequest {
  const pageSize = p.pageSize ?? DEFAULT_PAGE_SIZE;
  const page = Math.max(1, p.page ?? 1);
  const bands = getPriceBands(p.currency);
  const band = p.priceBand ? bands.find((b) => b.id === p.priceBand) : undefined;

  const filters: Expr[] = [];
  const text = p.text?.trim();
  if (text) filters.push({ fullText: { field: FIELD.name, language: p.locale, value: text } });
  if (p.categoryId) filters.push({ exact: { field: FIELD.categoriesSubTree, value: p.categoryId } });
  if (band) filters.push(and([...priceScope(p), priceRange(band)]));
  if (p.availability === 'in-stock') filters.push(inStock);
  if (p.availability === 'out-of-stock') filters.push(outOfStock);

  const sort = sortFor(p.sort, p);
  const request = {
    ...(filters.length ? { query: and(filters) } : {}),
    ...(sort ? { sort } : {}),
    limit: pageSize,
    offset: (page - 1) * pageSize,
    facets: [
      { distinct: { name: 'categories', field: FIELD.categories, fieldType: 'reference', limit: MAX_CATEGORY_FACET_BUCKETS } },
      {
        ranges: {
          name: 'priceBands',
          field: FIELD.priceAmount,
          fieldType: 'long',
          filter: and(priceScope(p)),
          ranges: bands.map((b) => ({ key: b.id, ...(b.min !== undefined ? { from: b.min } : {}), ...(b.max !== undefined ? { to: b.max } : {}) })),
        },
      },
      { count: { name: 'inStock', filter: inStock } },
      { count: { name: 'outOfStock', filter: outOfStock } },
    ],
    productProjectionParameters: { priceCurrency: p.currency, priceCountry: p.country },
  };
  return request as unknown as ProductSearchRequest;
}

function parseFacets(response: ProductPagedSearchResponse): ListingFacets {
  const buckets = (name: string): { key: string; count: number }[] => {
    const facet = response.facets?.find((f) => f.name === name) as Partial<ProductSearchFacetResultBucket> | undefined;
    return (facet?.buckets ?? []).map((b) => ({ key: b.key, count: b.count }));
  };
  const count = (name: string): number => {
    const facet = response.facets?.find((f) => f.name === name) as Partial<ProductSearchFacetResultCount> | undefined;
    return facet?.value ?? 0;
  };
  return {
    categories: buckets('categories').map((b) => ({ id: b.key, count: b.count })),
    priceBands: buckets('priceBands').map((b) => ({ id: b.key, count: b.count })),
    availability: { inStock: count('inStock'), outOfStock: count('outOfStock') },
  };
}

export function mapSearchResponse(response: ProductPagedSearchResponse, p: SearchParams): SearchResult {
  const pageSize = p.pageSize ?? DEFAULT_PAGE_SIZE;
  return {
    products: projectionsOf(response, p),
    total: response.total,
    page: Math.max(1, p.page ?? 1),
    pageSize,
    facets: parseFacets(response),
  };
}

function projectionsOf(response: ProductPagedSearchResponse, ctx: Ctx): Product[] {
  return response.results.flatMap((r) => (r.productProjection ? [mapProduct(r.productProjection as ProductProjection, ctx)] : []));
}

/** Plain server function: call it from Server Components. Uses only `products().search()`. */
export async function searchProducts(p: SearchParams): Promise<SearchResult> {
  const { body } = await getApiRoot().products().search().post({ body: buildSearchRequest(p) }).execute();
  return mapSearchResponse(body, p);
}

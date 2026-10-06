import 'server-only';
import { cache } from 'react';
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

/** A SKU-like term: letters, digits and hyphens, at least 4 characters (e.g. `BANANAS-500G`). */
const SKU_LIKE = /^[A-Za-z0-9-]{4,}$/;

/** `*` and `?` are wildcard characters in the Product Search `wildcard` expression; `\` escapes them. */
const escapeWildcard = (text: string): string => text.replace(/[\\*?]/g, (c) => `\\${c}`);

/**
 * Text search, three OR clauses (live behaviour in PROJECT-FINDINGS.md section 4a):
 * - `fullText` on `name`: token based, ranks whole words ("milk" finds "Whole milk 1 L");
 * - `wildcard` `*text*` on `name`, case-insensitive: substring match, so German compounds are found ("milch" finds
 *   "Vollmilch 1 l") and partial words work ("mil"); `fullText` alone returns nothing for both;
 * - exact `variants.sku` (case-insensitive) when the text looks like a SKU.
 */
function textQuery(text: string, locale: string): Expr {
  const clauses: Expr[] = [
    { fullText: { field: FIELD.name, language: locale, value: text } },
    { wildcard: { field: FIELD.name, language: locale, value: `*${escapeWildcard(text)}*`, caseInsensitive: true } },
  ];
  if (SKU_LIKE.test(text)) clauses.push({ exact: { field: FIELD.sku, value: text, caseInsensitive: true } });
  return { or: clauses };
}

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
  if (text) filters.push(textQuery(text, p.locale));
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

/** Lean lookup (no facets) returning mapped products in the order commercetools returns them. */
async function lookup(query: Expr, ctx: Ctx, limit: number): Promise<Product[]> {
  const request = {
    query,
    limit,
    productProjectionParameters: { priceCurrency: ctx.currency, priceCountry: ctx.country },
  } as unknown as ProductSearchRequest;
  const { body } = await getApiRoot().products().search().post({ body: request }).execute();
  return projectionsOf(body, ctx);
}

/**
 * Exact slug match in the shopper's language. React `cache` dedupes calls within one server render
 * (`generateMetadata` and the page); it keys on arguments, so the context is flattened to primitives.
 */
const productBySlug = cache(async (slug: string, locale: string, currency: string, country: string): Promise<Product | null> => {
  const products = await lookup({ exact: { field: FIELD.slug, language: locale, value: slug } }, { locale, currency, country }, 1);
  return products[0] ?? null;
});
export const getProductBySlug = (slug: string, ctx: Ctx): Promise<Product | null> => productBySlug(slug, ctx.locale, ctx.currency, ctx.country);

/** The product that owns a variant SKU (exact `variants.sku`); used by the cart to link back to the PDP. */
export async function getProductBySku(sku: string, ctx: Ctx): Promise<Product | null> {
  const products = await lookup({ exact: { field: FIELD.sku, value: sku } }, ctx, 1);
  return products[0] ?? null;
}

const MAX_SEARCH_LIMIT = 100;

/** Products for the given ids, in the order of `ids`; unknown ids are skipped and duplicates collapsed. */
export async function getProductsByIds(ids: string[], ctx: Ctx): Promise<Product[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += MAX_SEARCH_LIMIT) chunks.push(unique.slice(i, i + MAX_SEARCH_LIMIT));
  const found = (await Promise.all(chunks.map((chunk) => lookup({ exact: { field: FIELD.id, values: chunk } }, ctx, chunk.length)))).flat();
  const byId = new Map(found.map((p) => [p.id, p]));
  return unique.flatMap((id) => {
    const product = byId.get(id);
    return product ? [product] : [];
  });
}

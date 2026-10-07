import 'server-only';
import type {
  ProductPagedSearchResponse,
  ProductProjection,
  ProductSearchFacetResultBucket,
  ProductSearchRequest,
} from '@commercetools/platform-sdk';
import { getPriceBands } from '@/lib/config/price-bands';
import { LISTING_PAGE_SIZE } from '@/lib/config/facets';
import { flattenTree } from '@/lib/mappers/category';
import { mapOffer, mergeFacts } from '@/lib/mappers/offer';
import type { CurrencyCode, CountryCode, Locale, Offer, SearchResult, SearchSort } from '@/lib/types';
import { marketFromLocale } from '@/lib/config/markets';
import { getCatalogFacts, getProductTypeIds, OFFER_TYPE_KEY } from './catalog';
import { getCategoryTree } from './categories';
import { getApiRoot } from './client';
import { withTimeout } from './timeout';

export interface SearchParams {
  locale: Locale;
  currency: string;
  country: string;
  text?: string;
  categoryKey?: string;
  band?: string;
  sort?: SearchSort;
  page?: number;
  /** Default 12. */
  pageSize?: number;
}

type Expr = Record<string, unknown>;

/** Product Search field names (verified live in H-10, see PROJECT-FINDINGS.md). */
const FIELD = {
  productType: 'productType',
  name: 'name',
  categoriesSubTree: 'categoriesSubTree',
  categories: 'categories',
  priceAmount: 'variants.prices.centAmount',
  priceCurrency: 'variants.prices.currencyCode',
  priceCountry: 'variants.prices.country',
  sku: 'variants.sku',
} as const;

const SKU_LIKE = /^[A-Za-z0-9-]{4,}$/;
const MAX_CATEGORY_FACET_BUCKETS = 100;
/** `*`, `?` and `\` are wildcard characters in a Product Search `wildcard` expression. */
const escapeWildcard = (text: string): string => text.replace(/[\\*?]/g, (c) => `\\${c}`);
const and = (expressions: Expr[]): Expr => (expressions.length === 1 ? (expressions[0] as Expr) : { and: expressions });

const priceScope = (p: Pick<SearchParams, 'currency' | 'country'>): Expr[] => [
  { exact: { field: FIELD.priceCurrency, value: p.currency } },
  { exact: { field: FIELD.priceCountry, value: p.country } },
];

function textQuery(text: string, locale: string): Expr {
  const clauses: Expr[] = [
    { fullText: { field: FIELD.name, language: locale, value: text } },
    { wildcard: { field: FIELD.name, language: locale, value: `*${escapeWildcard(text)}*`, caseInsensitive: true } },
  ];
  if (SKU_LIKE.test(text)) clauses.push({ exact: { field: FIELD.sku, value: text, caseInsensitive: true } });
  return { or: clauses };
}

/** Pure request builder. No availability facet or filter (Planner default: services have no inventory, D-019). */
export function buildSearchRequest(p: SearchParams, offerProductTypeId: string, categoryId?: string): ProductSearchRequest {
  const pageSize = p.pageSize ?? LISTING_PAGE_SIZE;
  const page = Math.max(1, p.page ?? 1);
  const bands = getPriceBands(p.currency);
  const band = p.band ? bands.find((candidate) => candidate.id === p.band) : undefined;

  const filters: Expr[] = [{ exact: { field: FIELD.productType, value: offerProductTypeId } }];
  const text = p.text?.trim();
  if (text) filters.push(textQuery(text, p.locale));
  if (categoryId) filters.push({ exact: { field: FIELD.categoriesSubTree, value: categoryId } });
  if (band) {
    filters.push(
      and([
        ...priceScope(p),
        { range: { field: FIELD.priceAmount, ...(band.min !== undefined ? { gte: band.min } : {}), ...(band.max !== undefined ? { lt: band.max } : {}) } },
      ]),
    );
  }

  const sort =
    p.sort === 'price-asc' || p.sort === 'price-desc'
      ? [{ field: FIELD.priceAmount, order: p.sort === 'price-asc' ? 'asc' : 'desc', mode: 'min', filter: and(priceScope(p)) }]
      : undefined;

  const request = {
    query: and(filters),
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
    ],
    productProjectionParameters: { priceCurrency: p.currency, priceCountry: p.country },
  };
  return request as unknown as ProductSearchRequest;
}

function buckets(response: ProductPagedSearchResponse, name: string): { key: string; count: number }[] {
  const facet = response.facets?.find((candidate) => candidate.name === name) as Partial<ProductSearchFacetResultBucket> | undefined;
  return (facet?.buckets ?? []).map((bucket) => ({ key: bucket.key, count: bucket.count }));
}

/** Text search over offers (Product Search API; the index lags a seed run by minutes). Results are mapped like listing offers. */
export async function searchOffers(p: SearchParams): Promise<SearchResult> {
  const market = marketFromLocale(p.locale);
  const [ids, tree, facts] = await Promise.all([getProductTypeIds(), getCategoryTree(p.locale), getCatalogFacts(p.locale)]);
  const offerTypeId = ids[OFFER_TYPE_KEY];
  if (!offerTypeId) throw new Error(`Product type ${OFFER_TYPE_KEY} not found`);
  const categories = flattenTree(tree);
  const categoryId = p.categoryKey ? categories.find((category) => category.key === p.categoryKey)?.id : undefined;
  const request = buildSearchRequest({ ...p, currency: market.currency as CurrencyCode, country: market.country as CountryCode }, offerTypeId, categoryId);
  const { body } = await withTimeout(getApiRoot().products().search().post({ body: request }).execute(), 'search.offers');

  const categoryIdToKey = Object.fromEntries(categories.map((category) => [category.id, category.key]));
  const now = new Date();
  const offers: Offer[] = [];
  for (const result of body.results) {
    if (!result.productProjection) continue;
    const mapped = mapOffer(result.productProjection as ProductProjection, { market, categoryIdToKey, now });
    if (!mapped) continue;
    const offer = mergeFacts(mapped, facts);
    if (offer.facts !== null && (offer.headline.recurring || offer.headline.oneTime)) offers.push(offer);
  }
  return {
    offers,
    total: body.total,
    page: Math.max(1, p.page ?? 1),
    pageSize: p.pageSize ?? LISTING_PAGE_SIZE,
    categoryFacet: buckets(body, 'categories').flatMap((bucket) => {
      const key = categoryIdToKey[bucket.key];
      return key ? [{ key, count: bucket.count }] : [];
    }),
    bandFacet: buckets(body, 'priceBands').map((bucket) => ({ id: bucket.key, count: bucket.count })),
  };
}

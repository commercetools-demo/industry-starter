import type { Category as SdkCategory } from '@commercetools/platform-sdk';
import addonAppleTv from '@/lib/mappers/__fixtures__/addon-appletv.json';
import categoryFixture from '@/lib/mappers/__fixtures__/categories.json';
import offerAddonAppleTv from '@/lib/mappers/__fixtures__/offer-addon-appletv.json';
import { buildCategoryTree, mapCategory } from '@/lib/mappers/category';
import type { OfferFacts } from '@/lib/types';
import { mapFacts } from '@/lib/mappers/offer';
import type { ProductProjection } from '@commercetools/platform-sdk';

const post = vi.fn();
const search = vi.fn(() => ({ post }));
const getProject = vi.fn();
vi.mock('./client', () => ({ getApiRoot: () => ({ products: () => ({ search }), get: () => ({ execute: getProject }) }) }));
vi.mock('./timeout', () => ({ withTimeout: (promise: Promise<unknown>) => promise }));
vi.mock('./categories', () => ({
  getCategoryTree: async () => buildCategoryTree((categoryFixture as unknown as SdkCategory[]).map((category) => mapCategory(category, 'en-US'))),
}));
vi.mock('./catalog', () => ({
  OFFER_TYPE_KEY: 'malva-offer',
  getProductTypeIds: async () => ({ 'malva-offer': 'OFFER-TYPE' }),
  getCatalogFacts: async (): Promise<Record<string, OfferFacts>> => ({
    'malva-appletv': mapFacts(addonAppleTv as unknown as ProductProjection, 'malva-addon', 'en-US') as OfferFacts,
  }),
}));

import { ApiError } from '@/lib/api-error';
import { buildOfferTextQuery, buildSearchRequest, getSearchLanguages, resetSearchLanguagesCache, searchOfferHits, searchOffers, type SearchParams } from './search';

const base: SearchParams = { locale: 'en-US', currency: 'USD', country: 'US' };
const typeFilter = { exact: { field: 'productType', value: 'OFFER-TYPE' } };
const scope = [
  { exact: { field: 'variants.prices.currencyCode', value: 'USD' } },
  { exact: { field: 'variants.prices.country', value: 'US' } },
];
const build = (p: Partial<SearchParams>, categoryId?: string) => buildSearchRequest({ ...base, ...p }, 'OFFER-TYPE', categoryId) as unknown as Record<string, unknown>;

describe('buildSearchRequest', () => {
  it('restricts to the offer product type and pages from offset 0', () => {
    const request = build({});
    expect(request.query).toEqual(typeFilter);
    expect(request).toMatchObject({ limit: 12, offset: 0, productProjectionParameters: { priceCurrency: 'USD', priceCountry: 'US' } });
  });

  it('text: full text and wildcard on the name of the locale', () => {
    expect(build({ text: 'fast cable' }).query).toEqual({
      and: [
        typeFilter,
        {
          or: [
            { fullText: { field: 'name', language: 'en-US', value: 'fast cable' } },
            { wildcard: { field: 'name', language: 'en-US', value: '*fast cable*', caseInsensitive: true } },
          ],
        },
      ],
    });
  });

  it('SKU-like text adds a case-insensitive exact SKU clause', () => {
    const query = build({ text: 'MLV-CBL-500-24M' }).query as { and: [unknown, { or: unknown[] }] };
    expect(query.and[1].or).toContainEqual({ exact: { field: 'variants.sku', value: 'MLV-CBL-500-24M', caseInsensitive: true } });
  });

  it('escapes wildcard characters in the user text', () => {
    const query = build({ text: 'a*b?c\\d' }).query as { and: [unknown, { or: { wildcard?: { value: string } }[] }] };
    expect(query.and[1].or[1]?.wildcard?.value).toBe('*a\\*b\\?c\\\\d*');
  });

  it('category subtree filter', () => {
    expect(build({}, 'CAT-ID').query).toEqual({ and: [typeFilter, { exact: { field: 'categoriesSubTree', value: 'CAT-ID' } }] });
  });

  it('price band: currency, country and range on the same price', () => {
    expect(build({ band: '25-50' }).query).toEqual({
      and: [typeFilter, { and: [...scope, { range: { field: 'variants.prices.centAmount', gte: 2500, lt: 5000 } }] }],
    });
    expect(build({ band: 'gt-75' }).query).toEqual({
      and: [typeFilter, { and: [...scope, { range: { field: 'variants.prices.centAmount', gte: 7500 } }] }],
    });
  });

  it('price sorts use the minimum price of the market', () => {
    for (const [sort, order] of [['price-asc', 'asc'], ['price-desc', 'desc']] as const) {
      expect(build({ sort }).sort).toEqual([{ field: 'variants.prices.centAmount', order, mode: 'min', filter: { and: scope } }]);
    }
  });

  it('relevance omits the sort', () => {
    expect('sort' in build({ sort: 'relevance' })).toBe(false);
  });

  it('page 2 starts at offset 12', () => {
    expect(build({ page: 2 })).toMatchObject({ limit: 12, offset: 12 });
    expect(build({ page: 3, pageSize: 5 })).toMatchObject({ limit: 5, offset: 10 });
  });

  it('asks for category and price band facets and no availability facet', () => {
    const facets = build({}).facets as { distinct?: { name: string }; ranges?: { name: string; ranges: unknown[] } }[];
    expect(facets.map((facet) => facet.distinct?.name ?? facet.ranges?.name)).toEqual(['categories', 'priceBands']);
    expect(facets[1]?.ranges?.ranges).toHaveLength(4);
    expect(JSON.stringify(facets)).not.toContain('availability');
  });
});

describe('searchOffers', () => {
  it('calls products().search().post and returns mapped offers with facts merged', async () => {
    post.mockReturnValue({
      execute: async () => ({
        body: {
          total: 1,
          results: [{ id: 'x', productProjection: offerAddonAppleTv }],
          facets: [
            { name: 'categories', buckets: [{ key: 'fc4b1b5a-837f-4a33-8cb9-ddb95a525d4f', count: 1 }, { key: 'unknown', count: 1 }] },
            { name: 'priceBands', buckets: [{ key: 'lt-25', count: 1 }] },
          ],
        },
      }),
    });
    const result = await searchOffers({ ...base, text: 'apple', categoryKey: 'malva-cat-streaming' });
    expect(search).toHaveBeenCalled();
    const sent = post.mock.calls[0]?.[0] as { body: { query: { and: unknown[] } } };
    expect(JSON.stringify(sent.body.query)).toContain('fc4b1b5a-837f-4a33-8cb9-ddb95a525d4f');
    expect(result.total).toBe(1);
    expect(result.offers[0]).toMatchObject({ key: 'malva-offer-appletv', facts: { kind: 'addon', tag: 'video' }, headline: { recurring: { centAmount: 1000 } } });
    expect(result.categoryFacet).toEqual([{ key: 'malva-cat-streaming', count: 1 }]);
    expect(result.bandFacet).toEqual([{ id: 'lt-25', count: 1 }]);
  });
});

// ===== P: offer text search =====
type TextQuery = { and?: unknown[]; or?: Record<string, Record<string, unknown>>[] };
const clausesOf = (text: string, locale: 'en-US' | 'de-DE' = 'en-US'): Record<string, Record<string, unknown>>[] =>
  (buildOfferTextQuery({ text, locale }) as unknown as { query: TextQuery }).query.or ?? [];

describe('buildOfferTextQuery', () => {
  it('Part number pasted: SKU clause is built only for an identifier-shaped query', () => {
    for (const sku of ['MLV-CBL-500-24M', 'mlv-cbl-500-24m']) {
      expect(clausesOf(sku)[0]).toEqual({ exact: { field: 'variants.sku', value: sku, caseInsensitive: true, boost: 10 } });
    }
    expect(clausesOf('cable 500').some((clause) => 'exact' in clause)).toBe(false);
    expect(clausesOf('ab').some((clause) => 'exact' in clause)).toBe(false);
  });

  it('Misspelt query: a fuzzy expression with level 2 is part of the query', () => {
    expect(clausesOf('Unlimitd', 'de-DE')).toContainEqual({ fuzzy: { field: 'name', language: 'de-DE', value: 'Unlimitd', level: 2 } });
    expect(clausesOf('Unlimitd', 'de-DE').filter((clause) => 'fuzzy' in clause)).toHaveLength(1);
  });

  it('full text on the URL locale with boost 3, limit 100 and matching variants marked', () => {
    expect(clausesOf('cable 500')).toContainEqual({ fullText: { field: 'name', language: 'en-US', value: 'cable 500', boost: 3 } });
    expect(buildOfferTextQuery({ text: 'cable', locale: 'en-US' })).toMatchObject({ limit: 100, offset: 0, markMatchingVariants: true });
  });

  it('cuts a query longer than 100 characters and stays far below the 50-expression limit', () => {
    const clauses = clausesOf('x'.repeat(150));
    expect((clauses.find((clause) => 'fullText' in clause)?.fullText?.value as string).length).toBe(100);
    expect(clauses.length).toBeLessThanOrEqual(3);
  });

  it('restricts hits to the offer product type when its id is known', () => {
    const body = buildOfferTextQuery({ text: 'cable', locale: 'en-US', offerTypeId: 'OFFER-TYPE' }) as unknown as { query: TextQuery };
    expect(body.query.and?.[0]).toEqual(typeFilter);
  });
});

describe('searchOfferHits', () => {
  it('maps hit ids and the SKUs of partially matching variants', async () => {
    post.mockReturnValue({
      execute: async () => ({
        body: {
          total: 2,
          results: [
            { id: 'P1', matchingVariants: { allMatched: false, matchedVariants: [{ id: 2, sku: 'MLV-CBL-500-24M' }] } },
            { id: 'P2', matchingVariants: { allMatched: true, matchedVariants: [] } },
          ],
        },
      }),
    });
    const result = await searchOfferHits({ text: 'cable', locale: 'en-US' });
    expect(result).toEqual({
      total: 2,
      hits: [
        { id: 'P1', matchedSkus: ['MLV-CBL-500-24M'] },
        { id: 'P2', matchedSkus: [] },
      ],
    });
    expect(JSON.stringify(post.mock.calls.at(-1))).toContain('OFFER-TYPE');
  });

  it.each([400, 500])('an HTTP %i answer throws an ApiError without leaking the upstream error', async (statusCode) => {
    post.mockReturnValue({ execute: async () => Promise.reject(Object.assign(new Error('secret upstream detail'), { statusCode })) });
    const error = await searchOfferHits({ text: 'cable', locale: 'en-US' }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('UPSTREAM_ERROR');
    expect((error as ApiError).message).not.toContain('secret');
  });
});

describe('getSearchLanguages', () => {
  beforeEach(() => {
    resetSearchLanguagesCache();
    getProject.mockReset();
    getProject.mockResolvedValue({ body: { languages: ['en-GB', 'de-DE', 'en-US'] } });
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('caches the project languages for one hour and refreshes afterwards', async () => {
    expect(await getSearchLanguages()).toEqual(['en-GB', 'de-DE', 'en-US']);
    vi.advanceTimersByTime(59 * 60 * 1000);
    await getSearchLanguages();
    expect(getProject).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2 * 60 * 1000);
    await getSearchLanguages();
    expect(getProject).toHaveBeenCalledTimes(2);
  });

  it('an upstream failure throws an ApiError and is not cached', async () => {
    getProject.mockRejectedValueOnce(new Error('boom'));
    await expect(getSearchLanguages()).rejects.toBeInstanceOf(ApiError);
    expect(await getSearchLanguages()).toContain('en-US');
  });
});

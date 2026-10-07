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
vi.mock('./client', () => ({ getApiRoot: () => ({ products: () => ({ search }) }) }));
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

import { buildSearchRequest, searchOffers, type SearchParams } from './search';

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

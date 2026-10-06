import { describe, it, expect, vi, beforeEach } from 'vitest';
import weighed from '../mappers/__fixtures__/product-weighed.json';

const search = vi.fn();
const post = vi.fn();
const execute = vi.fn();
const productProjections = vi.fn();
vi.mock('./client', () => ({
  getApiRoot: () => ({
    products: () => ({ search: () => ({ post: (arg: unknown) => (post(arg), { execute }) }) }),
    productProjections,
  }),
}));

import { buildSearchRequest, searchProducts, type SearchParams } from './search';

const base: SearchParams = { locale: 'en-US', currency: 'USD', country: 'US' };
type Req = { query?: unknown; sort?: unknown; limit: number; offset: number; facets: Record<string, Record<string, unknown>>[]; productProjectionParameters: unknown };
const build = (p: Partial<SearchParams> = {}) => buildSearchRequest({ ...base, ...p }) as unknown as Req;

beforeEach(() => vi.clearAllMocks());

describe('buildSearchRequest', () => {
  it('no filters: no query and no sort, default page size 24 at offset 0', () => {
    const r = build();
    expect(r.query).toBeUndefined();
    expect(r.sort).toBeUndefined();
    expect(r.limit).toBe(24);
    expect(r.offset).toBe(0);
  });

  it('pagination: page 2 starts at offset 24; custom page size', () => {
    expect(build({ page: 2 }).offset).toBe(24);
    expect(build({ page: 3, pageSize: 10 })).toMatchObject({ limit: 10, offset: 20 });
    expect(build({ page: 0 }).offset).toBe(0);
  });

  it('price context: projection parameters carry currency and country', () => {
    expect(build({ currency: 'EUR', country: 'DE' }).productProjectionParameters).toEqual({ priceCurrency: 'EUR', priceCountry: 'DE' });
  });

  it('text: fullText and substring wildcard on name in the locale (OR)', () => {
    expect(build({ text: ' oat milk ', locale: 'de-DE' }).query).toEqual({
      or: [
        { fullText: { field: 'name', language: 'de-DE', value: 'oat milk' } },
        { wildcard: { field: 'name', language: 'de-DE', value: '*oat milk*', caseInsensitive: true } },
      ],
    });
  });

  it('text: wildcard characters typed by the shopper are escaped', () => {
    const query = build({ text: 'a*b?c\\d' }).query as { or: { wildcard?: { value: string } }[] };
    expect(query.or[1].wildcard?.value).toBe('*a\\*b\\?c\\\\d*');
  });

  it('text that looks like a SKU adds an exact, case-insensitive SKU clause', () => {
    const query = build({ text: 'bananas-500g' }).query as { or: unknown[] };
    expect(query.or).toHaveLength(3);
    expect(query.or[2]).toEqual({ exact: { field: 'variants.sku', value: 'bananas-500g', caseInsensitive: true } });
  });

  it('text that does not look like a SKU has no SKU clause (too short, spaces, other characters)', () => {
    for (const text of ['abc', 'oat drink', 'crème', 'a_b-c1']) {
      expect((build({ text }).query as { or: unknown[] }).or).toHaveLength(2);
    }
  });

  it('text combines with the other filters by AND', () => {
    const query = build({ text: 'milk', categoryId: 'c1' }).query as { and: unknown[] };
    expect(query.and).toHaveLength(2);
    expect(query.and[0]).toHaveProperty('or');
  });

  it('blank text is ignored', () => {
    expect(build({ text: '   ' }).query).toBeUndefined();
  });

  it('category: exact match on categoriesSubTree', () => {
    expect(build({ categoryId: 'cat-1' }).query).toEqual({ exact: { field: 'categoriesSubTree', value: 'cat-1' } });
  });

  it('price band: currency, country and amount range on the same price', () => {
    expect(build({ priceBand: '500-1500' }).query).toEqual({
      and: [
        { exact: { field: 'variants.prices.currencyCode', value: 'USD' } },
        { exact: { field: 'variants.prices.country', value: 'US' } },
        { range: { field: 'variants.prices.centAmount', gte: 500, lt: 1500 } },
      ],
    });
  });

  it('open-ended price bands use one bound', () => {
    const lt = build({ priceBand: 'lt-500' }).query as { and: { range?: unknown }[] };
    expect(lt.and[2].range).toEqual({ field: 'variants.prices.centAmount', lt: 500 });
    const gt = build({ priceBand: 'gt-3000' }).query as { and: { range?: unknown }[] };
    expect(gt.and[2].range).toEqual({ field: 'variants.prices.centAmount', gte: 3000 });
  });

  it('unknown price band is ignored', () => {
    expect(build({ priceBand: 'nope' }).query).toBeUndefined();
  });

  it('availability: in stock and out of stock', () => {
    const inStock = { exact: { field: 'variants.availability.isOnStock', value: true } };
    expect(build({ availability: 'in-stock' }).query).toEqual(inStock);
    expect(build({ availability: 'out-of-stock' }).query).toEqual({ not: [inStock] });
  });

  it('combined filters are ANDed', () => {
    const q = build({ text: 'bread', categoryId: 'c', availability: 'in-stock' }).query as { and: unknown[] };
    expect(q.and).toHaveLength(3);
  });

  it('sorts: relevance omits sort; newest; price asc and desc scoped to the market', () => {
    expect(build({ sort: 'relevance' }).sort).toBeUndefined();
    expect(build({ sort: 'newest' }).sort).toEqual([{ field: 'createdAt', order: 'desc' }]);
    const asc = build({ sort: 'price-asc' }).sort as Record<string, unknown>[];
    expect(asc[0]).toMatchObject({ field: 'variants.prices.centAmount', order: 'asc', mode: 'min' });
    expect(JSON.stringify(asc[0].filter)).toContain('"USD"');
    expect((build({ sort: 'price-desc' }).sort as Record<string, unknown>[])[0]).toMatchObject({ order: 'desc' });
  });

  it('facets: categories, price bands scoped to the market, in/out of stock', () => {
    const r = build({ currency: 'EUR', country: 'DE' });
    const names = r.facets.map((f) => (Object.values(f)[0] as { name: string }).name);
    expect(names).toEqual(['categories', 'priceBands', 'inStock', 'outOfStock']);
    const ranges = r.facets[1].ranges as { filter: unknown; ranges: { key: string }[] };
    expect(ranges.ranges.map((b) => b.key)).toEqual(['lt-500', '500-1500', '1500-3000', 'gt-3000']);
    expect(JSON.stringify(ranges.filter)).toContain('"DE"');
  });

  it('unknown currency: throws', () => {
    expect(() => build({ currency: 'JPY' })).toThrow(/JPY/);
  });
});

describe('searchProducts', () => {
  const response = {
    total: 30,
    offset: 24,
    limit: 24,
    facets: [
      { name: 'categories', buckets: [{ key: 'c1', count: 4 }] },
      { name: 'priceBands', buckets: [{ key: 'lt-500', count: 3 }] },
      { name: 'inStock', value: 25 },
      { name: 'outOfStock', value: 5 },
    ],
    results: [{ id: 'p1', productProjection: weighed }, { id: 'p-no-projection' }],
  };

  it('uses products().search().post, never productProjections()', async () => {
    execute.mockResolvedValue({ body: response });
    await searchProducts({ ...base, page: 2 });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toMatchObject({ body: { offset: 24, limit: 24 } });
    expect(productProjections).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });

  it('maps products, paging and facets into app types', async () => {
    execute.mockResolvedValue({ body: response });
    const result = await searchProducts({ ...base, page: 2 });
    expect(result.products.map((p) => p.name)).toEqual(['Bananas']);
    expect(result).toMatchObject({
      total: 30,
      page: 2,
      pageSize: 24,
      facets: {
        categories: [{ id: 'c1', count: 4 }],
        priceBands: [{ id: 'lt-500', count: 3 }],
        availability: { inStock: 25, outOfStock: 5 },
      },
    });
  });

  it('missing facets: empty facets and zero counts', async () => {
    execute.mockResolvedValue({ body: { total: 0, offset: 0, limit: 24, facets: [], results: [] } });
    const result = await searchProducts(base);
    expect(result.facets).toEqual({ categories: [], priceBands: [], availability: { inStock: 0, outOfStock: 0 } });
    expect(result.products).toEqual([]);
  });
});

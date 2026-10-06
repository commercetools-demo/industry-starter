import { describe, it, expect, vi, beforeEach } from 'vitest';
import weighed from '../mappers/__fixtures__/product-weighed.json';
import each from '../mappers/__fixtures__/product-each.json';

const post = vi.fn();
const execute = vi.fn();
vi.mock('./client', () => ({
  getApiRoot: () => ({ products: () => ({ search: () => ({ post: (arg: unknown) => (post(arg), { execute }) }) }) }),
}));
// Outside a request React's cache does not memoize; emulate its per-argument memoization.
vi.mock('react', async (orig) => ({
  ...(await orig<typeof import('react')>()),
  cache: <A extends unknown[], R>(fn: (...args: A) => R) => {
    const memo = new Map<unknown, R>();
    return (...args: A): R => {
      const key = JSON.stringify(args);
      if (!memo.has(key)) memo.set(key, fn(...args));
      return memo.get(key) as R;
    };
  },
}));

import { getProductBySku, getProductBySlug, getProductsByIds } from './search';

const ctx = { locale: 'en-US', currency: 'USD', country: 'US' };
const page = (...projections: unknown[]) => ({ body: { total: projections.length, offset: 0, limit: 24, facets: [], results: projections.map((p) => ({ id: 'x', productProjection: p })) } });
const bananasId = (weighed as { id: string }).id;
const milkId = (each as { id: string }).id;

beforeEach(() => {
  vi.clearAllMocks();
  execute.mockReset();
});

describe('getProductBySlug', () => {
  it('queries an exact slug in the locale language and maps the product', async () => {
    execute.mockResolvedValue(page(weighed));
    const product = await getProductBySlug('bananas', ctx);
    expect(product?.name).toBe('Bananas');
    expect(post.mock.calls[0][0].body.query).toEqual({ exact: { field: 'slug', language: 'en-US', value: 'bananas' } });
    expect(post.mock.calls[0][0].body.productProjectionParameters).toEqual({ priceCurrency: 'USD', priceCountry: 'US' });
  });

  it('not found: returns null', async () => {
    execute.mockResolvedValue(page());
    expect(await getProductBySlug('nope', ctx)).toBeNull();
  });

  it('same slug and market twice in one request: one search call', async () => {
    execute.mockResolvedValue(page(weighed));
    await Promise.all([getProductBySlug('dedupe-me', ctx), getProductBySlug('dedupe-me', { ...ctx })]);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('different locale: separate call', async () => {
    execute.mockResolvedValue(page(weighed));
    await getProductBySlug('bananas-x', ctx);
    await getProductBySlug('bananas-x', { locale: 'de-DE', currency: 'EUR', country: 'DE' });
    expect(post).toHaveBeenCalledTimes(2);
  });
});

describe('getProductBySku', () => {
  it('exact variants.sku match', async () => {
    execute.mockResolvedValue(page(weighed));
    expect((await getProductBySku('BANANAS-1KG', ctx))?.id).toBe(bananasId);
    expect(post.mock.calls[0][0].body.query).toEqual({ exact: { field: 'variants.sku', value: 'BANANAS-1KG' } });
  });

  it('unknown SKU: returns null', async () => {
    execute.mockResolvedValue(page());
    expect(await getProductBySku('NOPE', ctx)).toBeNull();
  });
});

describe('getProductsByIds', () => {
  it('empty list: no request', async () => {
    expect(await getProductsByIds([], ctx)).toEqual([]);
    expect(post).not.toHaveBeenCalled();
  });

  it('returns products in the order of the ids, skipping unknown ids and duplicates', async () => {
    execute.mockResolvedValue(page(weighed, each));
    const products = await getProductsByIds([milkId, 'missing', bananasId, milkId], ctx);
    expect(products.map((p) => p.id)).toEqual([milkId, bananasId]);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0].body.query).toEqual({ exact: { field: 'id', values: [milkId, 'missing', bananasId] } });
    expect(post.mock.calls[0][0].body.limit).toBe(3);
  });

  it('more than 100 ids: split into several requests', async () => {
    execute.mockResolvedValue(page());
    await getProductsByIds(Array.from({ length: 150 }, (_, i) => `id-${i}`), ctx);
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0][0].body.limit).toBe(100);
    expect(post.mock.calls[1][0].body.limit).toBe(50);
  });
});

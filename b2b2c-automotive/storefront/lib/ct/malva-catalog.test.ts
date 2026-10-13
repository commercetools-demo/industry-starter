// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseListingParams } from '@/lib/search/params';

const categoriesGet = vi.hoisted(() => vi.fn());
const searchPost = vi.hoisted(() => vi.fn());
const projectionsGet = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({
  apiRoot: {
    categories: () => ({ get: (args: unknown) => ({ execute: () => categoriesGet(args) }) }),
    products: () => ({ search: () => ({ post: (args: unknown) => ({ execute: () => searchPost(args) }) }) }),
    productProjections: () => ({ get: (args: unknown) => ({ execute: () => projectionsGet(args) }) }),
  },
  projectKey: 'p',
}));

const cat = (id: string, de: string, en: string) => ({ id, name: { 'de-DE': de, 'en-US': en }, slug: { 'de-DE': de.toLowerCase(), 'en-US': en.toLowerCase() } });
const roots = [cat('c-brakes', 'Bremsen', 'Brakes'), cat('c-lighting', 'Licht', 'Lighting'), cat('c-filters', 'Filter', 'Filters')];
const facetBody = (buckets: { key: string; count: number }[]) => ({ body: { facets: [{ name: 'roots', buckets }] } });

const load = () => import('./malva-catalog');

beforeEach(() => {
  vi.resetModules();
  categoriesGet.mockReset();
  searchPost.mockReset();
  projectionsGet.mockReset();
  categoriesGet.mockResolvedValue({ body: { results: roots } });
});

describe('Malva navigation: getMalvaNavCategories', () => {
  it('drops a root with no products', async () => {
    searchPost.mockResolvedValue(facetBody([{ key: 'c-brakes', count: 4 }, { key: 'c-filters', count: 2 }, { key: 'c-lighting', count: 0 }]));
    const list = await (await load()).getMalvaNavCategories('en-US');
    expect(list.map((c) => c.name)).toEqual(['Brakes', 'Filters']);
  });
  it('asks the whole catalog: no stores clause, no query', async () => {
    searchPost.mockResolvedValue(facetBody([{ key: 'c-brakes', count: 1 }]));
    await (await load()).getMalvaNavCategories('en-US');
    const { body } = searchPost.mock.calls[0][0] as { body: Record<string, unknown> };
    expect(JSON.stringify(body)).not.toContain('stores');
    expect(body.query).toBeUndefined();
    expect(body.limit).toBe(0);
  });
  it('localizes the slug', async () => {
    searchPost.mockResolvedValue(facetBody([{ key: 'c-brakes', count: 1 }]));
    expect(await (await load()).getMalvaNavCategories('de-DE')).toEqual([{ id: 'c-brakes', slug: 'bremsen', name: 'Bremsen' }]);
  });
  it('falls back to one search per root when the facet is unsupported', async () => {
    searchPost.mockImplementation(async ({ body }: { body: { facets?: unknown; query?: { exact: { value: string } } } }) => {
      if (body.facets) throw new Error('unsupported');
      return { body: { total: body.query?.exact.value === 'c-brakes' ? 3 : 0 } };
    });
    const list = await (await load()).getMalvaNavCategories('en-US');
    expect(list.map((c) => c.id)).toEqual(['c-brakes']);
    expect(JSON.stringify(searchPost.mock.calls.map((c) => c[0]))).not.toContain('stores');
  });
  it('is cached for five minutes per locale', async () => {
    searchPost.mockResolvedValue(facetBody([{ key: 'c-brakes', count: 1 }]));
    const { getMalvaNavCategories } = await load();
    await getMalvaNavCategories('en-US');
    await getMalvaNavCategories('en-US');
    expect(categoriesGet).toHaveBeenCalledTimes(1);
    await getMalvaNavCategories('de-DE');
    expect(categoriesGet).toHaveBeenCalledTimes(2);
  });
  it('serves the stale list during an outage and an empty list without one', async () => {
    vi.useFakeTimers();
    try {
      searchPost.mockResolvedValue(facetBody([{ key: 'c-brakes', count: 1 }]));
      const { getMalvaNavCategories } = await load();
      const first = await getMalvaNavCategories('en-US');
      vi.advanceTimersByTime(301_000);
      categoriesGet.mockRejectedValue(new Error('down'));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      expect(await getMalvaNavCategories('en-US')).toEqual(first);
      expect(await getMalvaNavCategories('de-DE')).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});

const projection = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  name: { 'en-US': `Part ${id}` },
  slug: { 'en-US': `part-${id}` },
  masterVariant: {
    id: 1,
    sku: `SKU-${id}`,
    images: [{ url: 'https://images.example.test/p.jpg', label: 'Pad', dimensions: { w: 1, h: 1 } }],
    prices: [{ id: 'pr', value: { centAmount: 4999, currencyCode: 'EUR', fractionDigits: 2 } }],
    availability: { isOnStock: true, availableQuantity: 9, channels: { ch1: { isOnStock: true, availableQuantity: 3 } } },
    attributes: [
      { name: 'part-number', value: 'MLV-BP-41001' },
      { name: 'brand', value: { key: 'vektra', label: 'Vektra' } },
      { name: 'fitment-keys', value: ['VW|Golf|2012|2019|2.0 TDI'] },
      { name: 'universal-fit', value: false },
    ],
  },
  variants: [],
  ...over,
});

describe('Malva listing: searchMalvaProducts and mapMalvaSummary', () => {
  const params = parseListingParams({});
  it('sends a query without stores, price or inventory and reads projections without a store or price argument', async () => {
    searchPost.mockResolvedValue({ body: { results: [{ id: 'a' }], total: 1, facets: [] } });
    projectionsGet.mockResolvedValue({ body: { results: [projection('a')] } });
    await (await load()).searchMalvaProducts({ locale: 'en-US', params, categoryId: 'c-brakes', fitKeys: null });
    const sent = JSON.stringify(searchPost.mock.calls[0][0]);
    expect(sent).toContain('categoriesSubTree');
    expect(sent).not.toMatch(/stores|price|availability|inventory/i);
    const args = JSON.stringify(projectionsGet.mock.calls[0][0]);
    expect(args).not.toMatch(/storeProjection|price|channel|inventory/i);
  });
  it('keeps the order of the search and drops an id that has no projection', async () => {
    searchPost.mockResolvedValue({ body: { results: [{ id: 'b' }, { id: 'gone' }, { id: 'a' }], total: 3, facets: [] } });
    projectionsGet.mockResolvedValue({ body: { results: [projection('a'), projection('b')] } });
    const result = await (await load()).searchMalvaProducts({ locale: 'en-US', params, categoryId: 'c', fitKeys: null });
    expect(result.items.map((i) => i.id)).toEqual(['b', 'a']);
  });
  it('the summary has no price, stock or link field', async () => {
    searchPost.mockResolvedValue({ body: { results: [{ id: 'a' }], total: 1, facets: [] } });
    projectionsGet.mockResolvedValue({ body: { results: [projection('a')] } });
    const { items } = await (await load()).searchMalvaProducts({ locale: 'en-US', params, categoryId: 'c', fitKeys: null });
    expect(Object.keys(items[0]).sort()).toEqual(['brand', 'fitmentKeys', 'id', 'imageAlt', 'imageUrl', 'name', 'partNumber', 'sku', 'universalFit']);
    expect(JSON.stringify(items)).not.toMatch(/4999|centAmount|availab|quantity|stock|slug/i);
  });
  it('maps part number, brand, image and fit data; the part number falls back to the sku', async () => {
    const { mapMalvaSummary } = await load();
    expect(mapMalvaSummary(projection('a') as never, 'en-US')).toMatchObject({
      id: 'a',
      sku: 'SKU-a',
      partNumber: 'MLV-BP-41001',
      name: 'Part a',
      brand: 'Vektra',
      imageUrl: 'https://images.example.test/p.jpg',
      imageAlt: 'Pad',
      fitmentKeys: ['VW|Golf|2012|2019|2.0 TDI'],
      universalFit: false,
    });
    const bare = projection('b', { masterVariant: { id: 1, sku: 'SKU-b', attributes: [] } });
    expect(mapMalvaSummary(bare as never, 'en-US')).toMatchObject({ partNumber: 'SKU-b', brand: '', imageUrl: undefined, imageAlt: 'Part b', fitmentKeys: [] });
  });
  it('an empty result reads no projections, and total pages and facets come from the search', async () => {
    searchPost.mockResolvedValue({ body: { results: [], total: 50, facets: [{ name: 'brand', buckets: [{ key: 'vektra', count: 2 }] }] } });
    const result = await (await load()).searchMalvaProducts({ locale: 'en-US', params, categoryId: 'c', fitKeys: null });
    expect(projectionsGet).not.toHaveBeenCalled();
    expect(result).toMatchObject({ items: [], total: 50, page: 1, totalPages: 3, facets: [{ name: 'brand', buckets: [{ key: 'vektra', count: 2 }] }] });
  });
  it('refuses an id that is not a product id', async () => {
    searchPost.mockResolvedValue({ body: { results: [{ id: 'a"; drop' }], total: 1, facets: [] } });
    await expect((await load()).searchMalvaProducts({ locale: 'en-US', params, categoryId: 'c', fitKeys: null })).rejects.toThrow('Invalid product id');
  });
});

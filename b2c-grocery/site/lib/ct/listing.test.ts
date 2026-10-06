// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ListingFacets, SearchResult } from '../types';

const searchProducts = vi.hoisted(() => vi.fn());
vi.mock('./search', () => ({ searchProducts }));

import { loadListing } from './listing';

const ctx = { locale: 'en-US', currency: 'USD', country: 'US' };
const facets = (tag: number): ListingFacets => ({
  categories: [{ id: `cat-${tag}`, count: tag }],
  priceBands: [{ id: `band-${tag}`, count: tag }],
  availability: { inStock: tag, outOfStock: tag },
});
const res = (tag: number, total: number): SearchResult => ({ products: [], total, page: 1, pageSize: 24, facets: facets(tag) });

beforeEach(() => {
  searchProducts.mockReset();
});

describe('loadListing', () => {
  it('without active filters it runs a single search', async () => {
    searchProducts.mockResolvedValue(res(1, 36));
    const out = await loadListing({ ...ctx });
    expect(searchProducts).toHaveBeenCalledTimes(1);
    expect(out.facets).toEqual(facets(1));
    expect(out.categoryTotal).toBe(36);
  });

  it('each active filter group takes its counts from a search without that filter', async () => {
    searchProducts.mockImplementation(async (p: { categoryId?: string; priceBand?: string; availability?: string }) => {
      if (!p.categoryId) return res(2, 20); // without category
      if (!p.priceBand) return res(3, 15); // without price
      if (!p.availability) return res(4, 12); // without availability
      return res(1, 5); // main
    });
    const out = await loadListing({ ...ctx, categoryId: 'c', priceBand: 'b', availability: 'in-stock', page: 2 });
    expect(searchProducts).toHaveBeenCalledTimes(4);
    expect(out.total).toBe(5);
    expect(out.facets.categories).toEqual([{ id: 'cat-2', count: 2 }]);
    expect(out.facets.priceBands).toEqual([{ id: 'band-3', count: 3 }]);
    expect(out.facets.availability).toEqual({ inStock: 4, outOfStock: 4 });
    expect(out.categoryTotal).toBe(20);
    const lean = searchProducts.mock.calls.map(([p]) => p).filter((p) => p.pageSize === 1);
    expect(lean).toHaveLength(3);
    expect(lean.every((p) => p.page === 1 && p.sort === undefined)).toBe(true);
  });

  it('all searches start before any resolves', async () => {
    const resolvers: (() => void)[] = [];
    searchProducts.mockImplementation(() => new Promise((resolve) => resolvers.push(() => resolve(res(1, 1)))));
    const pending = loadListing({ ...ctx, categoryId: 'c', priceBand: 'b' });
    expect(searchProducts).toHaveBeenCalledTimes(3);
    resolvers.forEach((r) => r());
    await pending;
  });
});

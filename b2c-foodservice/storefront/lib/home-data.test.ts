import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, ProductSummary, Store } from '@/lib/types';

const m = vi.hoisted(() => ({
  getCategoryTree: vi.fn(),
  getChannelByKey: vi.fn(),
  getProductSummaryByKey: vi.fn(),
  getListingProjections: vi.fn(),
  searchProducts: vi.fn(),
  content: { hero: { featuredProductKey: 'mcf-p-ember-ristretto' as string | null } },
}));
vi.mock('@/lib/ct/categories', () => ({ getCategoryTree: m.getCategoryTree }));
vi.mock('@/lib/ct/channels', () => ({ getChannelByKey: m.getChannelByKey }));
vi.mock('@/lib/ct/home-products', () => ({ getProductSummaryByKey: m.getProductSummaryByKey }));
vi.mock('@/lib/ct/products', () => ({ getListingProjections: m.getListingProjections }));
vi.mock('@/lib/ct/search', () => ({ searchProducts: m.searchProducts }));
vi.mock('@/content/home', () => ({ HOME_CONTENT: m.content }));

import {
  countSubscribable, getFeaturedProduct, getHomeStore, getHomeTree, searchHomeProducts,
} from '@/lib/home-data';

const ctx = { locale: 'en-US', country: 'US', currency: 'USD' };
const tree: Category[] = [{ id: 'c1', key: 'mcf-cat-pods', name: 'Pods', slug: 'pods', children: [] }];
const store = { id: 'ch1', key: 'mcf-store-nyc-soho', name: 'Malva SoHo', country: 'US', collectionMinutes: 15 } as unknown as Store;
const card = (id: string) => ({ id, slug: id, sku: id, name: id }) as unknown as ProductSummary;

beforeEach(() => {
  vi.clearAllMocks();
  m.content.hero.featuredProductKey = 'mcf-p-ember-ristretto';
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('home data', () => {
  it('a failing section returns empty and the others still return', async () => {
    m.searchProducts.mockImplementation(async (_c: unknown, _s: unknown, params: { facets: Record<string, string[]> }) => {
      if (params.facets.collection?.[0] === 'bestseller') throw Object.assign(new Error('x'), { statusCode: 503 });
      return { status: 'ok', total: 1, ids: ['a'], matchedSkus: {}, facets: [], page: 1, pageCount: 1 };
    });
    m.getListingProjections.mockResolvedValue([card('a')]);
    const [best, fresh] = await Promise.all([
      searchHomeProducts('bestseller', ctx, tree, null),
      searchHomeProducts('new', ctx, tree, null),
    ]);
    expect(best).toEqual([]);
    expect(fresh).toHaveLength(1);
    const logged = JSON.parse(vi.mocked(console.error).mock.calls[0]![0] as string);
    expect(logged).toEqual({ event: 'home_section_failed', section: 'bestseller', status: 503 });
  });

  it('a failing category tree gives an empty list', async () => {
    m.getCategoryTree.mockRejectedValue(new Error('down'));
    expect(await getHomeTree(ctx)).toEqual([]);
  });

  it('featured product null when the key is unset', async () => {
    m.content.hero.featuredProductKey = null;
    expect(await getFeaturedProduct(ctx, tree, null)).toBeNull();
    expect(m.getProductSummaryByKey).not.toHaveBeenCalled();
  });

  it('featured product is read with the shopper market and null on failure', async () => {
    m.getProductSummaryByKey.mockResolvedValue(card('p'));
    expect(await getFeaturedProduct(ctx, tree, store)).toEqual(card('p'));
    expect(m.getProductSummaryByKey).toHaveBeenCalledWith('mcf-p-ember-ristretto', expect.objectContaining({ country: 'US', currency: 'USD', storeChannelId: 'ch1' }));
    m.getProductSummaryByKey.mockRejectedValue(new Error('x'));
    expect(await getFeaturedProduct(ctx, tree, null)).toBeNull();
  });

  it('bestsellers query asks for badge bestseller with four results', async () => {
    m.searchProducts.mockResolvedValue({ status: 'ok', total: 0, ids: [], matchedSkus: {}, facets: [], page: 1, pageCount: 1 });
    await searchHomeProducts('bestseller', ctx, tree, null);
    const [searchCtx, , params, opts] = m.searchProducts.mock.calls[0]!;
    expect(searchCtx).toEqual({ locale: 'en-US', currency: 'USD', country: 'US' });
    expect(params.facets).toEqual({ collection: ['bestseller'] });
    expect(opts).toEqual({ limit: 4, withFacets: false });
  });

  it('subscribable count uses one result and total only', async () => {
    m.searchProducts.mockResolvedValue({ status: 'ok', total: 7, ids: ['a'], matchedSkus: {}, facets: [], page: 1, pageCount: 7 });
    expect(await countSubscribable(ctx)).toBe(7);
    expect(m.searchProducts.mock.calls[0]![3]).toEqual({ limit: 1, withFacets: false });
    m.searchProducts.mockRejectedValue(new Error('x'));
    expect(await countSubscribable(ctx)).toBe(0);
  });

  it('an unsupported language gives no products', async () => {
    m.searchProducts.mockResolvedValue({ status: 'unsupported_language' });
    expect(await searchHomeProducts('new', ctx, tree, null)).toEqual([]);
    expect(await countSubscribable(ctx)).toBe(0);
  });

  it('the session store resolves only in a market with collection and in its own country', async () => {
    m.getChannelByKey.mockResolvedValue(store);
    expect(await getHomeStore({ ...ctx, collectionStoreKey: 'mcf-store-nyc-soho' })).toEqual(store);
    expect(await getHomeStore(ctx)).toBeNull();
    expect(await getHomeStore({ locale: 'en-CA', country: 'CA', currency: 'CAD', collectionStoreKey: 'mcf-store-nyc-soho' })).toBeNull();
    m.getChannelByKey.mockResolvedValue(null);
    expect(await getHomeStore({ ...ctx, collectionStoreKey: 'gone' })).toBeNull();
  });

  it('no server cache wraps product searches', () => {
    for (const file of ['lib/home-data.ts', 'lib/ct/home-products.ts']) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      expect(source).not.toMatch(/unstable_cache|cachedPublic|use cache/);
    }
  });
});

import fixture from '@/lib/mappers/__fixtures__/categories.json';
import { CATEGORY_TREE_TTL } from '@/lib/config/cache';

const execute = vi.fn();
const get = vi.fn(() => ({ execute }));
const unstableCache = vi.fn<(fn: () => Promise<unknown>, keys: string[], options: object) => () => Promise<unknown>>((fn) => fn);
const withTimeout = vi.fn<(promise: Promise<unknown>, label: string) => Promise<unknown>>((promise) => promise);

vi.mock('next/cache', () => ({ unstable_cache: (fn: () => Promise<unknown>, keys: string[], options: object) => unstableCache(fn, keys, options) }));
vi.mock('./client', () => ({ getApiRoot: () => ({ categories: () => ({ get }) }) }));
vi.mock('./timeout', () => ({ withTimeout: (promise: Promise<unknown>, label: string) => withTimeout(promise, label) }));

import { getCategoryByKey, getCategoryBySlug, getCategoryTree } from './categories';

beforeEach(() => {
  vi.clearAllMocks();
  execute.mockResolvedValue({ body: { results: fixture, total: fixture.length } });
});

describe('category reads', () => {
  it('reads the whole tree with one call and caches it per locale', async () => {
    const tree = await getCategoryTree('en-US');
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith({ queryArgs: { limit: 500 } });
    expect(unstableCache).toHaveBeenCalledWith(expect.any(Function), ['category-tree', 'en-US'], { revalidate: CATEGORY_TREE_TTL, tags: ['catalog'] });
    expect(tree.map((category) => category.key)).toEqual([
      'malva-cat-phone-plans',
      'malva-cat-home-wireless',
      'malva-cat-cable-internet',
      'malva-cat-add-ons',
      'malva-cat-devices',
    ]);
  });

  it('the call goes through withTimeout', async () => {
    await getCategoryTree('de-DE');
    expect(withTimeout).toHaveBeenCalledWith(expect.anything(), 'categories.tree');
  });

  it('the slug of the other locale resolves with matchedLocale', async () => {
    const match = await getCategoryBySlug('phone-plans', 'de-DE');
    expect(match?.category.key).toBe('malva-cat-phone-plans');
    expect(match?.matchedLocale).toBe('en-US');
    expect((await getCategoryBySlug('handytarife', 'de-DE'))?.matchedLocale).toBe('de-DE');
  });

  it('an unknown slug gives null', async () => {
    expect(await getCategoryBySlug('nope', 'en-US')).toBeNull();
  });

  it('finds a nested category by key', async () => {
    expect((await getCategoryByKey('malva-cat-equipment', 'en-US'))?.name).toBe('Routers & equipment');
    expect(await getCategoryByKey('missing', 'en-US')).toBeNull();
  });
});

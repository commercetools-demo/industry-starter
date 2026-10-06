import { describe, it, expect, vi, beforeEach } from 'vitest';
import fixture from '../mappers/__fixtures__/categories.json';

const unstableCache = vi.fn((...args: [() => unknown, string[], { revalidate: number }]) => args[0]);
vi.mock('next/cache', () => ({ unstable_cache: (...args: [() => unknown, string[], { revalidate: number }]) => unstableCache(...args) }));

const execute = vi.fn();
const get = vi.fn();
vi.mock('./client', () => ({ getApiRoot: () => ({ categories: () => ({ get: (arg: unknown) => (get(arg), { execute }) }) }) }));

import { getCategoryBySlug, getCategoryTree } from './categories';

beforeEach(() => {
  vi.clearAllMocks();
  execute.mockResolvedValue({ body: { total: fixture.length, count: fixture.length, offset: 0, limit: 500, results: fixture } });
});

describe('getCategoryTree', () => {
  it('cache wrapper: revalidate 60 and the key includes the locale', async () => {
    await getCategoryTree('de-DE');
    await getCategoryTree('en-US');
    expect(unstableCache.mock.calls[0][1]).toEqual(['category-tree', 'de-DE']);
    expect(unstableCache.mock.calls[0][2]).toEqual({ revalidate: 60 });
    expect(unstableCache.mock.calls[1][1]).toEqual(['category-tree', 'en-US']);
  });

  it('maps the project categories into a localized tree', async () => {
    const tree = await getCategoryTree('de-DE');
    expect(tree.map((c) => c.slug)).toEqual(['obst-gemuese', 'milch-eier', 'backwaren', 'vorrat', 'getraenke', 'haushalt']);
    expect(get.mock.calls[0][0].queryArgs).toMatchObject({ sort: 'orderHint asc' });
  });

  it('fetches further pages until the total is reached', async () => {
    execute
      .mockResolvedValueOnce({ body: { total: fixture.length, results: fixture.slice(0, 3) } })
      .mockResolvedValueOnce({ body: { total: fixture.length, results: fixture.slice(3) } });
    expect(await getCategoryTree('en-US')).toHaveLength(fixture.length);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[1][0].queryArgs.offset).toBe(500);
  });
});

describe('getCategoryBySlug', () => {
  it('finds a category by the slug of the locale', async () => {
    expect((await getCategoryBySlug('milch-eier', 'de-DE'))?.key).toBe('dairy-eggs');
    expect((await getCategoryBySlug('dairy-eggs', 'en-US'))?.key).toBe('dairy-eggs');
  });

  it('slug of another locale or unknown: null', async () => {
    expect(await getCategoryBySlug('dairy-eggs', 'de-DE')).toBeNull();
    expect(await getCategoryBySlug('nope', 'en-US')).toBeNull();
  });
});

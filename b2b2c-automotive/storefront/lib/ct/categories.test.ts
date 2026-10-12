// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const categoriesGet = vi.hoisted(() => vi.fn());
const searchPost = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({
  apiRoot: {
    categories: () => ({ get: (args: unknown) => ({ execute: () => categoriesGet(args) }) }),
    products: () => ({ search: () => ({ post: (args: unknown) => ({ execute: () => searchPost(args) }) }) }),
  },
  projectKey: 'p',
}));

const cat = (id: string, de: string, en: string) => ({ id, name: { 'de-DE': de, 'en-US': en }, slug: { 'de-DE': de.toLowerCase(), 'en-US': en.toLowerCase() } });
const roots = [cat('c-brakes', 'Bremsen', 'Brakes'), cat('c-lighting', 'Licht', 'Lighting'), cat('c-filters', 'Filter', 'Filters')];

const load = async () => (await import('./categories')).getNavCategories;

beforeEach(() => {
  vi.resetModules();
  categoriesGet.mockReset();
  searchPost.mockReset();
  categoriesGet.mockResolvedValue({ body: { results: roots } });
});

describe('Excluded line disappears: lib/ct/categories', () => {
  it('drops a root with no products', async () => {
    searchPost.mockResolvedValue({ body: { facets: [{ name: 'roots', buckets: [{ key: 'c-brakes', count: 4 }, { key: 'c-filters', count: 2 }, { key: 'c-lighting', count: 0 }] }] } });
    const list = await (await load())('store-1', 'en-US');
    expect(list.map((c) => c.name)).toEqual(['Brakes', 'Filters']);
    expect(list.some((c) => c.id === 'c-lighting')).toBe(false);
  });
  it('keeps order hint order', async () => {
    searchPost.mockResolvedValue({ body: { facets: [{ name: 'roots', buckets: [{ key: 'c-filters', count: 2 }, { key: 'c-brakes', count: 4 }] }] } });
    expect((await (await load())('store-1', 'en-US')).map((c) => c.id)).toEqual(['c-brakes', 'c-filters']);
    expect(categoriesGet).toHaveBeenCalledWith({ queryArgs: { where: 'parent is not defined', sort: 'orderHint asc', limit: 50 } });
  });
  it('localizes the slug', async () => {
    searchPost.mockResolvedValue({ body: { facets: [{ name: 'roots', buckets: [{ key: 'c-brakes', count: 1 }] }] } });
    expect(await (await load())('store-1', 'de-DE')).toEqual([{ id: 'c-brakes', slug: 'bremsen', name: 'Bremsen' }]);
  });
  it('asks one facet call scoped to the store', async () => {
    searchPost.mockResolvedValue({ body: { facets: [{ name: 'roots', buckets: [] }] } });
    await (await load())('store-1', 'en-US');
    expect(searchPost).toHaveBeenCalledTimes(1);
    expect(searchPost.mock.calls[0][0].body).toMatchObject({ query: { exact: { field: 'stores', value: 'store-1' } }, limit: 0 });
  });
  it('falls back to one search per root when the facet is unsupported', async () => {
    searchPost.mockImplementation(async ({ body }: { body: { facets?: unknown; query: { and?: { exact: { value: string } }[] } } }) => {
      if (body.facets) throw { statusCode: 400 };
      return { body: { total: body.query.and?.[1].exact.value === 'c-brakes' ? 3 : 0 } };
    });
    expect((await (await load())('store-1', 'en-US')).map((c) => c.id)).toEqual(['c-brakes']);
  });
  it('is cached per store and locale for five minutes', async () => {
    searchPost.mockResolvedValue({ body: { facets: [{ name: 'roots', buckets: [{ key: 'c-brakes', count: 1 }] }] } });
    const fn = await load();
    await fn('store-1', 'en-US');
    await fn('store-1', 'en-US');
    expect(categoriesGet).toHaveBeenCalledTimes(1);
    await fn('store-1', 'de-DE');
    expect(categoriesGet).toHaveBeenCalledTimes(2);
  });
  it('a failure without a previous list is an empty navigation, not a crash', async () => {
    categoriesGet.mockRejectedValue({ statusCode: 503 });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await (await load())('store-1', 'en-US')).toEqual([]);
    error.mockRestore();
  });
});

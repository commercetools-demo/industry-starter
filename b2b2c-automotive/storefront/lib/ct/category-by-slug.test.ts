// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const categoriesGet = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ apiRoot: { categories: () => ({ get: (args: unknown) => ({ execute: () => categoriesGet(args) }) }), products: () => ({}) }, projectKey: 'p' }));

const load = async () => (await import('./categories')).getCategoryBySlug;
const cat = (id: string, de: string, en: string, ancestors: unknown[] = []) => ({
  id,
  name: { 'de-DE': de, 'en-US': en },
  slug: { 'de-DE': de.toLowerCase(), 'en-US': en.toLowerCase() },
  ancestors: ancestors.map((obj) => ({ typeId: 'category', id: (obj as { id: string }).id, obj })),
});

beforeEach(() => {
  vi.resetModules();
  categoriesGet.mockReset();
});

describe('Page header states context: lib/ct/categories getCategoryBySlug', () => {
  it('returns the category with its ancestors, root first, localized', async () => {
    const root = cat('c-brakes', 'Bremsen', 'Brakes');
    categoriesGet.mockResolvedValue({ body: { results: [cat('c-pads', 'Beläge', 'Pads', [root])] } });
    const out = await (await load())('pads', 'en-US');
    expect(out).toEqual({ id: 'c-pads', slug: 'pads', name: 'Pads', ancestors: [{ id: 'c-brakes', slug: 'brakes', name: 'Brakes' }] });
    const args = categoriesGet.mock.calls[0][0].queryArgs;
    expect(args).toMatchObject({ where: 'slug(en-US="pads")', expand: ['ancestors[*]'], limit: 1 });
  });

  it('unknown category is null', async () => {
    categoriesGet.mockResolvedValue({ body: { results: [] } });
    expect(await (await load())('nope', 'en-US')).toBeNull();
  });

  it('a slug that could break the predicate is null without a call', async () => {
    expect(await (await load())('a") or id is defined or slug(de-DE="x', 'en-US')).toBeNull();
    expect(categoriesGet).not.toHaveBeenCalled();
  });

  it('is cached per slug and locale', async () => {
    categoriesGet.mockResolvedValue({ body: { results: [cat('c-pads', 'Beläge', 'Pads')] } });
    const fn = await load();
    await fn('pads', 'en-US');
    await fn('pads', 'en-US');
    expect(categoriesGet).toHaveBeenCalledTimes(1);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
const state = vi.hoisted(() => ({ results: [] as unknown[], calls: 0 }));
vi.mock('@/lib/ct/client', () => ({
  apiRoot: { categories: () => ({ get: () => ({ execute: async () => { state.calls += 1; return { body: { results: state.results } }; } }) }) },
}));

import { breadcrumbOf, getCategoryByKey, getCategoryBySlug, getCategoryTree } from '@/lib/ct/categories';
import { idByKey, rootCategoryName } from '@/lib/category-tree';

const cat = (id: string, key: string, slug: string, name: string, parent?: string, orderHint = '0.1') => ({
  id, key, name: { 'en-US': name, 'en-CA': `${name} CA` }, slug: { 'en-US': slug, 'en-CA': `${slug}-ca` }, orderHint,
  ...(parent ? { parent: { typeId: 'category', id: parent } } : {}),
});

beforeEach(() => {
  state.calls = 0;
  state.results = [
    cat('c-b', 'mcf-cat-b', 'b', 'Beta', undefined, '0.2'),
    cat('c-a', 'mcf-cat-a', 'a', 'Alpha', undefined, '0.1'),
    cat('c-a2', 'mcf-cat-a-2', 'a-two', 'Alpha Two', 'c-a', '0.2'),
    cat('c-a1', 'mcf-cat-a-1', 'a-one', 'Alpha One', 'c-a', '0.1'),
  ];
});

describe('categories', () => {
  it('tree sorted by order hint', async () => {
    const tree = await getCategoryTree('en-US');
    expect(tree.map((c) => c.id)).toEqual(['c-a', 'c-b']);
    expect(tree[0]!.children.map((c) => c.id)).toEqual(['c-a1', 'c-a2']);
  });
  it('breadcrumb walks ancestors', async () => {
    const tree = await getCategoryTree('en-US');
    expect(breadcrumbOf(tree, 'c-a2').map((c) => c.name)).toEqual(['Alpha', 'Alpha Two']);
    expect(breadcrumbOf(tree, 'nope')).toEqual([]);
    expect(rootCategoryName(tree, ['c-a1'])).toBe('Alpha');
    expect(idByKey(tree)['mcf-cat-a-1']).toBe('c-a1');
  });
  it('slug lookup uses the locale', async () => {
    expect((await getCategoryBySlug('en-CA', 'a-one-ca'))?.id).toBe('c-a1');
    expect(await getCategoryBySlug('en-US', 'a-one-ca')).toBeNull();
  });
  it('unknown slug returns null', async () => {
    expect(await getCategoryBySlug('en-US', 'nope')).toBeNull();
    expect((await getCategoryByKey('en-US', 'mcf-cat-b'))?.name).toBe('Beta');
  });
});

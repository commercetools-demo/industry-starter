// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, ProductSummary } from '@/lib/types';

const h = vi.hoisted(() => ({ search: vi.fn(), projections: vi.fn() }));
vi.mock('@/lib/ct/categories', () => ({ getCategoryTree: async () => TREE }));
vi.mock('@/lib/ct/channels', () => ({ getStoresForCountry: async () => [] }));
vi.mock('@/lib/ct/search', () => ({ searchProducts: h.search }));
vi.mock('@/lib/ct/products', () => ({ getListingProjections: h.projections }));
vi.mock('@/lib/session', () => ({ getSession: async () => ({}) }));

const TREE: Category[] = [
  {
    id: 'c-pods', key: 'mcf-cat-pods', name: 'Pods', slug: 'pods', children: [
      { id: 'c-orig', key: 'mcf-cat-pods-original', name: 'Original', slug: 'original-pods', parentId: 'c-pods', children: [] },
    ],
  },
  { id: 'c-mach', key: 'mcf-cat-machines', name: 'Machines', slug: 'machines', children: [] },
];

import { getCompatibleCapsules, getRelatedProducts } from '@/lib/related';

const ctx = { locale: 'en-US', country: 'US', currency: 'USD' };
const product = { id: 'self', breadcrumb: [{ id: 'c-pods', name: 'Pods', slug: 'pods' }, { id: 'c-orig', name: 'Original', slug: 'original-pods' }] };
const byScope = (map: Record<string, string[]>) => (_ctx: unknown, scope: { categoryId?: string }, params: { facets: Record<string, string[]> }) =>
  Promise.resolve({
    status: 'ok',
    ids: map[scope.categoryId ?? (params.facets.collection ? 'bestsellers' : 'shop')] ?? [],
  });

beforeEach(() => {
  h.search.mockReset();
  h.projections.mockReset().mockImplementation(async (ids: string[]) => ids.map((id) => ({ id }) as ProductSummary));
});

describe('getRelatedProducts', () => {
  it('You may also like is same category first filled to four', async () => {
    h.search.mockImplementation(byScope({ 'c-orig': ['a', 'b', 'self', 'c'], 'c-pods': ['a', 'd', 'e', 'f'] }));
    const out = await getRelatedProducts(product, ctx);
    expect(out.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(h.search.mock.calls.map((c) => c[1].categoryId)).toEqual(['c-orig', 'c-pods']); // deepest first, then the root
    expect(h.search.mock.calls[0]![3]).toMatchObject({ limit: 5, withFacets: false });
    expect(h.search.mock.calls[1]![3]).toMatchObject({ limit: 8 });
    expect(h.projections).toHaveBeenCalledTimes(1); // one projection read for the final four
  });

  it('a full first read stops there', async () => {
    h.search.mockImplementation(byScope({ 'c-orig': ['a', 'b', 'c', 'd', 'e'] }));
    const out = await getRelatedProducts(product, ctx);
    expect(out.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(h.search).toHaveBeenCalledTimes(1);
  });

  it('drops the product itself', async () => {
    h.search.mockImplementation(byScope({ 'c-orig': ['self'], 'c-pods': ['self'], bestsellers: ['self', 'x'] }));
    const out = await getRelatedProducts(product, ctx);
    expect(out.map((p) => p.id)).toEqual(['x']);
  });

  it('bestsellers fill the remainder', async () => {
    h.search.mockImplementation(byScope({ 'c-orig': ['a'], 'c-pods': ['a', 'b'], bestsellers: ['b', 'c', 'd', 'e', 'f'] }));
    const out = await getRelatedProducts(product, ctx);
    expect(out.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd']);
    const last = h.search.mock.calls.at(-1)!;
    expect(last[1].categoryId).toBeUndefined();
    expect(last[2].facets).toEqual({ collection: ['bestseller'] });
  });

  it('a product in a root category only searches that category once', async () => {
    h.search.mockImplementation(byScope({ 'c-mach': ['a'], bestsellers: ['b'] }));
    await getRelatedProducts({ id: 'self', breadcrumb: [{ id: 'c-mach', name: 'Machines', slug: 'machines' }] }, ctx);
    expect(h.search.mock.calls.map((c) => c[1].categoryId)).toEqual(['c-mach', undefined]);
  });

  it('uses the shopper market for every read', async () => {
    h.search.mockImplementation(byScope({ 'c-orig': ['a', 'b', 'c', 'd'] }));
    await getRelatedProducts(product, { ...ctx, country: 'CA', currency: 'CAD', locale: 'en-CA' });
    expect(h.search.mock.calls[0]![0]).toMatchObject({ country: 'CA', currency: 'CAD', locale: 'en-CA' });
    expect(h.projections.mock.calls[0]![1]).toMatchObject({ country: 'CA', currency: 'CAD' });
  });
});

describe('getCompatibleCapsules', () => {
  it('Machine page leads with compatible capsules', async () => {
    h.search.mockImplementation(byScope({ 'c-pods': ['p1', 'p2'] }));
    const out = await getCompatibleCapsules({ shape: 'machine', systemKey: 'original' }, ctx);
    expect(out.map((p) => p.id)).toEqual(['p1', 'p2']);
    const [, scope, params, opts] = h.search.mock.calls[0]!;
    expect(scope.categoryId).toBe('c-pods');
    expect(params.facets).toEqual({ system: ['original'] });
    expect(opts).toMatchObject({ limit: 4 });
  });

  it('machines that take no capsules have no strip', async () => {
    for (const systemKey of ['bean-to-cup', 'espresso', 'filter', 'grinder']) {
      expect(await getCompatibleCapsules({ shape: 'machine', systemKey }, ctx)).toEqual([]);
    }
    expect(await getCompatibleCapsules({ shape: 'machine' }, ctx)).toEqual([]);
    expect(h.search).not.toHaveBeenCalled();
  });

  it('only machines get the strip', async () => {
    expect(await getCompatibleCapsules({ shape: 'pods', systemKey: 'original' }, ctx)).toEqual([]);
    expect(h.search).not.toHaveBeenCalled();
  });

  it('no capsule matching leaves the strip empty', async () => {
    h.search.mockImplementation(byScope({}));
    h.projections.mockResolvedValue([]);
    expect(await getCompatibleCapsules({ shape: 'machine', systemKey: 'vertuo' }, ctx)).toEqual([]);
  });
});

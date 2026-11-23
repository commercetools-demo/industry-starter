// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('notFound'); } }));

const tree = [
  { id: 'drinks', key: 'mcf-cat-instore-drinks', name: 'Ready-made coffee', slug: 'ready-made-coffee', instoreVisibility: 'onlyBarista', children: [] },
  { id: 'coffee', key: 'mcf-cat-coffee', name: 'Coffee', slug: 'coffee', instoreVisibility: 'both', children: [] },
  { id: 'gifts', key: 'mcf-cat-gifts', name: 'Gifts', slug: 'gifts', instoreVisibility: 'allThree', children: [] },
];
const product = (id: string, name: string) => ({ id, slug: id, sku: `SKU-${id}`, name, imageAlt: '', price: null });
const byCategory: Record<string, ReturnType<typeof product>[]> = {
  drinks: [product('a', 'Iced Coffee'), product('b', 'Hot Coffee')],
  gifts: [product('b', 'Hot Coffee'), product('c', 'Gift set')],
};

vi.mock('@/lib/ct/categories', () => ({ getCategoryTree: async () => tree }));
vi.mock('@/lib/ct/search', () => ({
  searchProducts: async (_ctx: unknown, scope: { categoryId: string }) => ({
    status: 'ok', ids: (byCategory[scope.categoryId] ?? []).map((p) => p.id), total: 2, page: 1, pageCount: 1,
  }),
}));
vi.mock('@/lib/ct/products', () => ({
  getListingProjections: async (ids: string[]) => ids.map((id) => Object.values(byCategory).flat().find((p) => p.id === id)),
}));
vi.mock('@/lib/ct/inventory', () => ({ getInventoryDetail: async () => ({}) }));

import { loadInstoreHome } from '@/lib/instore/category';

describe('In-store home', () => {
  it('lists the products of the categories the In-store visibility lets through, once each, and nothing of the others', async () => {
    const rows = await loadInstoreHome('en-US');
    expect(rows.map((r) => r.name)).toEqual(['Iced Coffee', 'Hot Coffee', 'Gift set']);
  });
});

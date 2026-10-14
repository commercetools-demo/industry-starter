// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const projectionsGet = vi.hoisted(() => vi.fn());
const projectionById = vi.hoisted(() => vi.fn());
const pricesGet = vi.hoisted(() => vi.fn());
const searchPost = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({
  apiRoot: {
    productProjections: () => ({
      get: (args: unknown) => ({ execute: () => projectionsGet(args) }),
      withId: (args: unknown) => ({ get: (a: unknown) => ({ execute: () => projectionById(args, a) }) }),
    }),
    standalonePrices: () => ({ get: (args: unknown) => ({ execute: () => pricesGet(args) }) }),
    products: () => ({ search: () => ({ post: (args: unknown) => ({ execute: () => searchPost(args) }) }) }),
  },
  projectKey: 'p',
}));

import { escapePredicate, getProductBySlug, getRelatedSummaries } from './product-detail';

const ctx = { locale: 'en-US', currency: 'USD', country: 'US', branchChannelId: 'b', retailChannelId: 'r' };
const money = (cent: number) => ({ type: 'centPrecision', currencyCode: 'USD', centAmount: cent, fractionDigits: 2 });
const proj = (id: string, sku: string, attributes: unknown[] = []) => ({
  id,
  name: { 'en-US': `Name ${id}` },
  slug: { 'en-US': `slug-${id}` },
  masterVariant: { id: 1, sku, images: [], attributes },
  variants: [],
  categories: [],
});

beforeEach(() => {
  for (const m of [projectionsGet, projectionById, pricesGet, searchPost]) m.mockReset();
  pricesGet.mockResolvedValue({ body: { results: [] } });
});

describe('getProductBySlug', () => {
  it('empty in-store result returns null', async () => {
    projectionsGet.mockResolvedValue({ body: { results: [] } });
    expect(await getProductBySlug('mau-reseller-south', 'withdrawn', ctx)).toBeNull();
    expect(projectionById).not.toHaveBeenCalled();
  });

  it('slug is escaped in the predicate', async () => {
    projectionsGet.mockResolvedValue({ body: { results: [] } });
    await getProductBySlug('mau-reseller-north', 'a"b\\c', ctx);
    expect(projectionsGet.mock.calls[0][0].queryArgs.where).toBe('slug(en-US="a\\"b\\\\c")');
    expect(escapePredicate('x"y')).toBe('x\\"y');
  });

  it('a slug over 256 characters is not-found without a call', async () => {
    expect(await getProductBySlug('mau-reseller-north', 'a'.repeat(257), ctx)).toBeNull();
    expect(projectionsGet).not.toHaveBeenCalled();
  });

  it('reads the store projection, then the master and the standalone prices', async () => {
    projectionsGet.mockResolvedValue({ body: { results: [proj('p1', 'SKU-1')] } });
    projectionById.mockResolvedValue({ body: proj('p1', 'SKU-1', [{ name: 'part-number', value: 'PN-1' }]) });
    pricesGet.mockResolvedValue({ body: { results: [{ id: 'sp', sku: 'SKU-1', value: money(4200), country: undefined, channel: undefined }] } });
    const detail = await getProductBySlug('mau-reseller-north', 'slug-p1', ctx);
    expect(detail?.partNumber).toBe('PN-1');
    expect(detail?.price?.centAmount).toBe(4200);
    expect(projectionsGet.mock.calls[0][0].queryArgs).toMatchObject({ storeProjection: 'mau-reseller-north', localeProjection: ['en-US'], limit: 1 });
    expect(projectionById.mock.calls[0][0]).toEqual({ ID: 'p1' });
  });

  it('price is read from standalone prices for the branch and currency', async () => {
    projectionsGet.mockResolvedValue({ body: { results: [proj('p2', 'SKU-2')] } });
    projectionById.mockResolvedValue({ body: proj('p2', 'SKU-2') });
    await getProductBySlug('mau-reseller-north', 'slug-p2', ctx);
    const where = pricesGet.mock.calls[0][0].queryArgs.where as string;
    expect(where).toContain('sku in ("SKU-2")');
    expect(where).toContain('currencyCode="USD"');
    expect(where).toContain('channel(id in ("b","r"))');
  });

  it('no projection call carries price arguments', async () => {
    projectionsGet.mockResolvedValue({ body: { results: [proj('p3', 'SKU-3')] } });
    projectionById.mockResolvedValue({ body: proj('p3', 'SKU-3') });
    await getProductBySlug('mau-reseller-north', 'slug-p3', ctx);
    const calls = [...projectionsGet.mock.calls.map((c) => c[0]), ...projectionById.mock.calls.map((c) => c[1])];
    for (const call of calls) {
      const args = JSON.stringify(call.queryArgs);
      expect(args).not.toMatch(/priceCurrency|priceCountry|priceChannel|priceCustomerGroup/);
    }
  });
});

describe('getRelatedSummaries', () => {
  const base = { id: 'p1', sku: 'SKU-1', categoryTrail: [{ id: 'cat-1', slug: 'brakes', name: 'Brakes' }] } as never;
  const scope = { storeId: 'store-1', fitKeys: null };

  it('related skus outside the store are dropped', async () => {
    projectionsGet.mockResolvedValue({ body: { results: [proj('a', 'REL-A')] } });
    const out = await getRelatedSummaries('mau-reseller-north', { ...(base as object), relatedSkus: ['REL-A', 'REL-OUTSIDE'] } as never, ctx, scope);
    expect(out.map((p) => p.sku)).toEqual(['REL-A']);
    expect(projectionsGet.mock.calls[0][0].queryArgs.where).toContain('"REL-A","REL-OUTSIDE"');
    expect(searchPost).not.toHaveBeenCalled();
  });

  it('related falls back to the same category and never lists the product itself', async () => {
    searchPost.mockResolvedValue({ body: { results: [{ id: 'p1' }, { id: 'a' }, { id: 'b' }], total: 3, facets: [] } });
    projectionsGet.mockResolvedValue({ body: { results: [proj('a', 'SA'), proj('b', 'SB')] } });
    const out = await getRelatedSummaries('mau-reseller-north', { ...(base as object), relatedSkus: [] } as never, ctx, scope);
    expect(out.map((p) => p.id)).toEqual(['a', 'b']);
    expect(JSON.stringify(searchPost.mock.calls[0][0])).toContain('cat-1');
    expect(projectionsGet.mock.calls[0][0].queryArgs.where).toBe('id in ("a","b")');
  });

  it('a product without a category has no fallback', async () => {
    expect(await getRelatedSummaries('mau-reseller-north', { ...(base as object), categoryTrail: [], relatedSkus: [] } as never, ctx, scope)).toEqual([]);
    expect(searchPost).not.toHaveBeenCalled();
  });
});

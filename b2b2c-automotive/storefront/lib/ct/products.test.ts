// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const projectionsGet = vi.hoisted(() => vi.fn());
const pricesGet = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({
  apiRoot: {
    productProjections: () => ({ get: (args: unknown) => ({ execute: () => projectionsGet(args) }) }),
    standalonePrices: () => ({ get: (args: unknown) => ({ execute: () => pricesGet(args) }) }),
  },
  projectKey: 'p',
}));

import { getListingProjections, getProductSummaries } from './products';

const ctx = { locale: 'en-US', currency: 'USD', country: 'US', branchChannelId: 'b', retailChannelId: 'r' };
const proj = (id: string, sku: string) => ({
  id,
  name: { 'en-US': `Name ${id}` },
  slug: { 'en-US': `slug-${id}` },
  masterVariant: { id: 1, sku, images: [], attributes: [] },
  variants: [],
});
const money = (cent: number) => ({ type: 'centPrecision', currencyCode: 'USD', centAmount: cent, fractionDigits: 2 });

beforeEach(() => {
  projectionsGet.mockReset();
  pricesGet.mockReset();
  pricesGet.mockResolvedValue({ body: { results: [] } });
});

describe('Listing projections: lib/ct/products', () => {
  it('keeps search order', async () => {
    projectionsGet.mockResolvedValue({ body: { results: [proj('a', 'SA'), proj('b', 'SB'), proj('c', 'SC')] } });
    const out = await getListingProjections('mau-reseller-north', ['c', 'a', 'b'], ctx);
    expect(out.map((o) => o.projection.id)).toEqual(['c', 'a', 'b']);
  });

  it('skips a missing projection', async () => {
    projectionsGet.mockResolvedValue({ body: { results: [proj('a', 'SA'), proj('c', 'SC')] } });
    const out = await getListingProjections('mau-reseller-north', ['a', 'b', 'c'], ctx);
    expect(out.map((o) => o.projection.id)).toEqual(['a', 'c']);
  });

  it('empty ids skip the projection and price calls', async () => {
    expect(await getListingProjections('mau-reseller-north', [], ctx)).toEqual([]);
    expect(projectionsGet).not.toHaveBeenCalled();
    expect(pricesGet).not.toHaveBeenCalled();
  });

  it('reads the store projection (assortment and tailoring), localized, without price arguments', async () => {
    projectionsGet.mockResolvedValue({ body: { results: [proj('a', 'SA')] } });
    await getListingProjections('mau-reseller-north', ['a'], ctx);
    const args = projectionsGet.mock.calls[0][0].queryArgs;
    expect(args).toMatchObject({ storeProjection: 'mau-reseller-north', where: 'id in ("a")', localeProjection: ['en-US'], limit: 1 });
  });

  it('no projection call carries priceCurrency priceCountry or priceChannel', async () => {
    projectionsGet.mockResolvedValue({ body: { results: [proj('a', 'SA')] } });
    await getListingProjections('mau-reseller-north', ['a'], ctx);
    const text = JSON.stringify(projectionsGet.mock.calls);
    expect(text).not.toMatch(/priceCurrency|priceCountry|priceChannel|priceCustomerGroup/);
  });

  it('one standalone price call for many skus, matched by sku', async () => {
    projectionsGet.mockResolvedValue({ body: { results: [proj('a', 'SA'), proj('b', 'SB')] } });
    pricesGet.mockResolvedValue({ body: { results: [{ id: 'p1', sku: 'SA', value: money(1000), active: true, country: 'US' }, { id: 'p2', sku: 'SB', value: money(2000), active: true, country: 'US' }] } });
    const out = await getListingProjections('mau-reseller-north', ['a', 'b'], ctx);
    expect(pricesGet).toHaveBeenCalledTimes(1);
    expect(pricesGet.mock.calls[0][0].queryArgs.where).toContain('sku in ("SA","SB")');
    expect(out[0].prices.map((p) => p.centAmount)).toEqual([1000]);
    expect(out[1].prices.map((p) => p.centAmount)).toEqual([2000]);
  });

  it('rejects a store key that is not a key', async () => {
    await expect(getListingProjections('x" or', ['a'], ctx)).rejects.toThrow('Invalid store key');
  });

  it('rejects an id that is not an id', async () => {
    await expect(getListingProjections('mau-reseller-north', ['a" or 1=1'], ctx)).rejects.toThrow('Invalid product id');
  });

  it('summaries map every product and show no price when none exists', async () => {
    projectionsGet.mockResolvedValue({ body: { results: [proj('a', 'SA')] } });
    const out = await getProductSummaries('mau-reseller-north', ['a'], ctx);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'a', sku: 'SA', name: 'Name a', price: null });
  });
});

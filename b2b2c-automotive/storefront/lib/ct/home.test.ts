// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branch } from '@/test/shell-fixtures';
import type { ShellContext } from '@/lib/types';

const m = vi.hoisted(() => ({
  getShellContext: vi.fn(),
  getSession: vi.fn(),
  getActiveVehicle: vi.fn(),
  getNavCategories: vi.fn(),
  searchParts: vi.fn(),
  getListingProjections: vi.fn(),
  mapProductSummary: vi.fn(),
}));
vi.mock('@/lib/ct/shell', () => ({ getShellContext: m.getShellContext }));
vi.mock('@/lib/session', () => ({ getSession: m.getSession }));
vi.mock('@/lib/vehicles/active', () => ({ getActiveVehicle: m.getActiveVehicle }));
vi.mock('@/lib/ct/categories', () => ({ getNavCategories: m.getNavCategories }));
vi.mock('@/lib/ct/search', () => ({ searchParts: m.searchParts }));
vi.mock('@/lib/ct/products', () => ({ getListingProjections: m.getListingProjections }));
vi.mock('@/lib/mappers/product-summary', () => ({ mapProductSummary: m.mapProductSummary }));

import { getHomeData, getPopularProducts } from './home';

const settings = { name: 'Küstenwerk Autoteile', shipDays: { min: 2, max: 3 }, timezone: 'Europe/Berlin' };
const hamburg = { ...branch({ key: 'mau-br-north-hamburg', name: 'Hamburg-Harburg' }), pickupMode: 'next-day' as const };
const berlin = { ...branch({ key: 'mau-br-north-berlin', name: 'Berlin-Mitte', address: { street: 's', postalCode: '1', city: 'Berlin' } }), pickupMode: 'ship-to-store' as const };
const shell = (branches: ShellContext['branches']): ShellContext => ({ storeId: 'store-1', settings, branches, retailChannelId: 'retail-1', countries: ['DE'] });
const cats = [{ id: 'c1', slug: 'brakes', name: 'Brakes' }];
const summary = (id: string) => ({ id, sku: id, slug: id, name: id, brand: 'B', imageAlt: '', rating: null, price: null, stock: { atBranch: true, quantity: 3 }, universalFit: false, fitmentKeys: ['k'], recurringEligible: false, variantCount: 1 });
const vehicle = { id: 'v1', make: 'VW', model: 'Golf', year: 2016, engine: '2.0 TDI', label: '2016 VW Golf', fitKeys: ['key-1'] };

beforeEach(() => {
  vi.resetAllMocks();
  m.getSession.mockResolvedValue({});
  m.getActiveVehicle.mockResolvedValue(null);
  m.getNavCategories.mockResolvedValue(cats);
  m.searchParts.mockResolvedValue({ ids: ['p1', 'p2'], total: 2, facets: [] });
  m.getListingProjections.mockImplementation(async (_s: string, ids: string[]) => ids.map((id) => ({ projection: { id }, prices: [] })));
  m.mapProductSummary.mockImplementation((p: { id: string }) => summary(p.id));
});

describe('getHomeData', () => {
  it('uses the selected branch for the promise', async () => {
    m.getShellContext.mockResolvedValue(shell([berlin, hamburg]));
    m.getSession.mockResolvedValue({ branchKey: 'mau-br-north-berlin' });
    const data = await getHomeData({ storeKey: 'mau-reseller-north', locale: 'en-US' }, { popular: false });
    expect(data?.branch).toEqual({ city: 'Berlin', name: 'Berlin-Mitte' });
    expect(data?.pickup).toBe('ship-to-store');
    m.getSession.mockResolvedValue({ branchKey: 'mau-br-north-hamburg' });
    expect((await getHomeData({ storeKey: 'mau-reseller-north', locale: 'en-US' }, { popular: false }))?.pickup).toBe('tomorrow');
  });

  it('single branch store still has a branch', async () => {
    m.getShellContext.mockResolvedValue(shell([hamburg]));
    const data = await getHomeData({ storeKey: 'mau-reseller-north', locale: 'de-DE' }, { popular: false });
    expect(data?.branch?.city).toBe('Hamburg');
    expect(data?.storeName).toBe('Küstenwerk Autoteile');
  });

  it('a store without branches ships to the shopper', async () => {
    m.getShellContext.mockResolvedValue(shell([]));
    const data = await getHomeData({ storeKey: 'mau-reseller-north', locale: 'de-DE' }, { popular: false });
    expect(data?.branch).toBeNull();
    expect(data?.pickup).toBe('ship-to-store');
  });

  it('categories equal the shell navigation', async () => {
    m.getShellContext.mockResolvedValue(shell([hamburg]));
    const data = await getHomeData({ storeKey: 'mau-reseller-north', locale: 'en-US' }, { popular: false });
    expect(m.getNavCategories).toHaveBeenCalledWith('store-1', 'en-US');
    expect(data?.categories).toEqual(cats);
  });

  it('an unknown store is null', async () => {
    m.getShellContext.mockResolvedValue(null);
    expect(await getHomeData({ storeKey: 'nope-store', locale: 'en-US' })).toBeNull();
  });

  it('popular is skipped when not requested and survives a search failure', async () => {
    m.getShellContext.mockResolvedValue(shell([hamburg]));
    expect((await getHomeData({ storeKey: 'mau-reseller-north', locale: 'en-US' }, { popular: false }))?.popular).toEqual([]);
    expect(m.searchParts).not.toHaveBeenCalled();
    m.searchParts.mockRejectedValue(new Error('down'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const data = await getHomeData({ storeKey: 'mau-reseller-north', locale: 'en-US' });
    expect(data?.popular).toEqual([]);
    expect(data?.categories).toEqual(cats);
  });
});

describe('getPopularProducts', () => {
  const ctxFor = (fitKeys: string[] | null) => ({ storeId: 'store-1', locale: 'en-US' as const, currency: 'USD', country: 'US', branchChannelId: hamburg.channelId, retailChannelId: 'retail-1', fitKeys });

  it('no vehicle lists popular products', async () => {
    const out = await getPopularProducts('mau-reseller-north', ctxFor(null), null, 8);
    const [ctx, scope, params] = m.searchParts.mock.calls[0];
    expect(ctx.fitKeys).toBeNull();
    expect(scope).toEqual({});
    expect(params).toMatchObject({ sort: 'popular', page: 1, fit: true, brand: [], pickup: false, attrs: {} });
    expect(out.map((i) => i.product.id)).toEqual(['p1', 'p2']);
    expect(out.every((i) => i.fit === 'unknown')).toBe(true);
  });

  it('only fitting products with a vehicle', async () => {
    await getPopularProducts('mau-reseller-north', ctxFor(vehicle.fitKeys), vehicle, 8);
    const [ctx, , params] = m.searchParts.mock.calls[0];
    expect(ctx.fitKeys).toEqual(['key-1']);
    expect(params.fit).toBe(true); // fit-only: the search request carries the fitment expression of J
  });

  it('slices to count and reads projections for those ids only', async () => {
    m.searchParts.mockResolvedValue({ ids: ['a', 'b', 'c', 'd', 'e'], total: 5, facets: [] });
    const out = await getPopularProducts('mau-reseller-north', ctxFor(null), null, 4);
    expect(m.getListingProjections.mock.calls[0][1]).toEqual(['a', 'b', 'c', 'd']);
    expect(out).toHaveLength(4);
  });
});

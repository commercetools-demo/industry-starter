// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import type { ProductProjection } from '@commercetools/platform-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { settings } from '@/test/shell-fixtures';

const getShellContext = vi.hoisted(() => vi.fn());
const getSession = vi.hoisted(() => vi.fn());
const getActiveVehicle = vi.hoisted(() => vi.fn());
const getCategoryBySlug = vi.hoisted(() => vi.fn());
const searchParts = vi.hoisted(() => vi.fn());
const countAssortment = vi.hoisted(() => vi.fn());
const getListingProjections = vi.hoisted(() => vi.fn());
const getEnumLabels = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ct/shell', () => ({ getShellContext }));
vi.mock('@/lib/session', () => ({ getSession }));
vi.mock('@/lib/vehicles/active', () => ({ getActiveVehicle }));
vi.mock('@/lib/ct/categories', () => ({ getCategoryBySlug }));
vi.mock('@/lib/ct/search', () => ({ searchParts, countAssortment }));
vi.mock('@/lib/ct/products', () => ({ getListingProjections }));
vi.mock('@/lib/ct/attribute-labels', () => ({ getEnumLabels }));

import { loadListing, type ListingInput, type ListingView } from './load';

const branch = (key: string, channelId: string, city: string) => ({ key, channelId, name: key, address: { street: '', postalCode: '', city }, hours: {}, timezone: 'Europe/Berlin', pickupMode: 'same-day' });
const shell = { storeId: 'store-1', settings, retailChannelId: 'ch-retail', countries: ['DE'], branches: [branch('mau-br-a', 'ch-a', 'Berlin'), branch('mau-br-b', 'ch-b', 'Hamburg')] };
const golf = { id: 'vw.golf.2016.2-0-tdi', make: 'Volkswagen', model: 'Golf', year: 2016, engine: '2.0 TDI', label: '2016 Volkswagen Golf · 2.0 TDI', fitKeys: ['Volkswagen|Golf|2012|2019|2.0 TDI'] };
const projection = (id: string, sku: string, attrs: { name: string; value: unknown }[] = []) =>
  ({ id, name: { 'en-US': `Name ${id}` }, slug: { 'en-US': `slug-${id}` }, masterVariant: { id: 1, sku, images: [], attributes: attrs, availability: { channels: { 'ch-a': { isOnStock: true, availableQuantity: 3 } } } }, variants: [] }) as unknown as ProductProjection;
const fitting = [{ name: 'fitment-keys', value: ['Volkswagen|Golf|2012|2019|2.0 TDI'] }, { name: 'brand', value: { key: 'vektra', label: 'Vektra' } }];
const usd = (centAmount: number) => ({ id: `p${centAmount}`, centAmount, currencyCode: 'USD', fractionDigits: 2, country: 'US' });
const input = (over: Partial<ListingInput> = {}): ListingInput => ({ storeKey: 'mau-reseller-north', locale: 'en-US', surface: { kind: 'all' }, searchParams: {}, ...over });
const ok = (r: Awaited<ReturnType<typeof loadListing>>): ListingView => {
  expect(r.kind).toBe('ok');
  return r as ListingView;
};

beforeEach(() => {
  for (const m of [getShellContext, getSession, getActiveVehicle, getCategoryBySlug, searchParts, countAssortment, getListingProjections, getEnumLabels]) m.mockReset();
  getShellContext.mockResolvedValue(shell);
  getSession.mockResolvedValue({ storeKey: 'mau-reseller-north' });
  getActiveVehicle.mockResolvedValue(null);
  getCategoryBySlug.mockResolvedValue(null);
  searchParts.mockResolvedValue({ ids: [], total: 0, facets: [] });
  countAssortment.mockResolvedValue(10);
  getListingProjections.mockResolvedValue([]);
  getEnumLabels.mockResolvedValue({});
});

describe('Listing shows the reseller assortment only: lib/listing/load', () => {
  it('excluded line absent', async () => {
    // the search is scoped to the store; a product the store withdrew is not in its ids and has no store projection
    searchParts.mockResolvedValue({ ids: ['kept', 'withdrawn'], total: 2, facets: [] });
    getListingProjections.mockResolvedValue([{ projection: projection('kept', 'SKU-K'), prices: [usd(1000)] }]);
    const view = ok(await loadListing(input()));
    expect(view.items.map((i) => i.product.id)).toEqual(['kept']);
    expect(searchParts.mock.calls[0][0]).toMatchObject({ storeId: 'store-1' });
    expect(getListingProjections).toHaveBeenCalledWith('mau-reseller-north', ['kept', 'withdrawn'], expect.objectContaining({ locale: 'en-US' }));
  });

  it('reseller local product looks like any other and shows no local marker', async () => {
    searchParts.mockResolvedValue({ ids: ['own'], total: 1, facets: [] });
    getListingProjections.mockResolvedValue([{ projection: projection('own', 'SK-2001', [{ name: 'brand-name', value: 'Küstenwerk' }, { name: 'owner-store', value: 'mau-reseller-north' }]), prices: [{ ...usd(900), channelId: 'ch-retail' }] }]);
    const [item] = ok(await loadListing(input())).items;
    expect(item.product).toMatchObject({ name: 'Name own', brand: 'Küstenwerk', price: { centAmount: 900 } });
    expect(Object.keys(item.product).sort()).toEqual(['brand', 'fitmentKeys', 'id', 'imageAlt', 'imageUrl', 'name', 'price', 'qualityLabel', 'rating', 'recurringEligible', 'sku', 'slug', 'stock', 'universalFit', 'variantCount'].sort());
    expect(item.fit).toBe('unknown');
  });

  it('prices follow the language of the address and the branch of the session', async () => {
    getSession.mockResolvedValue({ storeKey: 'mau-reseller-north', branchKey: 'mau-br-b' });
    ok(await loadListing(input({ locale: 'de-DE' })));
    expect(searchParts.mock.calls[0][0]).toMatchObject({ currency: 'EUR', country: 'DE', branchChannelId: 'ch-b', retailChannelId: 'ch-retail', locale: 'de-DE' });
    expect(ok(await loadListing(input())).city).toBe('Hamburg');
  });

  it('unknown store is not found', async () => {
    getShellContext.mockResolvedValue(null);
    expect(await loadListing(input())).toEqual({ kind: 'not-found' });
  });
});

describe('Filters held in the address: lib/listing/load', () => {
  it('shared link applies brand and sort and evaluates fit for the session vehicle', async () => {
    getActiveVehicle.mockResolvedValue(golf);
    searchParts.mockResolvedValue({ ids: ['fit', 'nofit'], total: 2, facets: [] });
    getListingProjections.mockResolvedValue([
      { projection: projection('fit', 'S1', fitting), prices: [usd(1000)] },
      { projection: projection('nofit', 'S2', [{ name: 'fitment-keys', value: ['BMW|3 Series|2012|2019|320d'] }]), prices: [usd(2000)] },
    ]);
    const view = ok(await loadListing(input({ searchParams: { brand: 'vektra', sort: 'price-asc' } })));
    const [ctx, , params] = searchParts.mock.calls[0];
    expect(ctx.fitKeys).toEqual(golf.fitKeys);
    expect(params).toMatchObject({ brand: ['vektra'], sort: 'price-asc', fit: true });
    expect(view.items.map((i) => i.fit)).toEqual(['fits', 'does-not-fit']);
    expect(view.fitScopeOn).toBe(true);
    expect(view.vehicleLabel).toBe(golf.label);
  });

  it('fit=0 keeps the vehicle for the badges but drops the fit scope from the query', async () => {
    getActiveVehicle.mockResolvedValue(golf);
    const view = ok(await loadListing(input({ searchParams: { fit: '0' } })));
    expect(searchParts.mock.calls[0][2]).toMatchObject({ fit: false });
    expect(view.fitScopeOn).toBe(false);
  });

  it('no matches shows an empty result with its facets', async () => {
    searchParts.mockResolvedValue({ ids: [], total: 0, facets: [{ name: 'brand', buckets: [{ key: 'vektra', count: 2 }] }] });
    const view = ok(await loadListing(input({ searchParams: { brand: 'kestrel' } })));
    expect(view.items).toEqual([]);
    expect(view.total).toBe(0);
    expect(view.groups[0].options.map((o) => [o.key, o.selected])).toEqual([['kestrel', true], ['vektra', false]]);
    expect(getListingProjections).toHaveBeenCalledWith('mau-reseller-north', [], expect.anything());
  });

  it('facet labels come from the product type', async () => {
    searchParts.mockResolvedValue({ ids: [], total: 5, facets: [{ name: 'brand', buckets: [{ key: 'malva-select', count: 5 }] }] });
    getEnumLabels.mockResolvedValue({ brand: { 'malva-select': 'Malva Select' } });
    expect(ok(await loadListing(input())).groups[0].options[0].label).toBe('Malva Select');
  });

  it('a page beyond the last redirects to the last page', async () => {
    searchParts.mockResolvedValue({ ids: [], total: 50, facets: [] });
    const result = await loadListing(input({ searchParams: { page: '99' } }));
    expect(result).toMatchObject({ kind: 'redirect', page: 3 });
    expect(getListingProjections).not.toHaveBeenCalled();
  });

  it('page 2 of an empty result redirects to page 1', async () => {
    expect(await loadListing(input({ searchParams: { page: '2' } }))).toMatchObject({ kind: 'redirect', page: 1 });
  });

  it('reports page numbers', async () => {
    searchParts.mockResolvedValue({ ids: [], total: 50, facets: [] });
    expect(ok(await loadListing(input({ searchParams: { page: '2' } })))).toMatchObject({ page: 2, totalPages: 3, total: 50 });
  });
});

describe('Page header states context: categories and search in lib/listing/load', () => {
  const brakes = { id: 'cat-brakes', slug: 'brakes', name: 'Brakes', ancestors: [] };

  it('category scopes the search to its subtree', async () => {
    getCategoryBySlug.mockResolvedValue(brakes);
    searchParts.mockResolvedValue({ ids: [], total: 4, facets: [] });
    const view = ok(await loadListing(input({ surface: { kind: 'category', slug: 'brakes' } })));
    expect(searchParts.mock.calls[0][1]).toEqual({ categoryId: 'cat-brakes' });
    expect(view.category).toEqual(brakes);
    expect(getCategoryBySlug).toHaveBeenCalledWith('brakes', 'en-US');
  });

  it('unknown category 404', async () => {
    getCategoryBySlug.mockResolvedValue(null);
    expect(await loadListing(input({ surface: { kind: 'category', slug: 'nope' } }))).toEqual({ kind: 'not-found' });
    expect(searchParts).not.toHaveBeenCalled();
  });

  it('category with no store products 404', async () => {
    getCategoryBySlug.mockResolvedValue(brakes);
    countAssortment.mockResolvedValue(0);
    expect(await loadListing(input({ surface: { kind: 'category', slug: 'brakes' } }))).toEqual({ kind: 'not-found' });
  });

  it('a category with products but no match for the filters is an empty state, not a 404', async () => {
    getCategoryBySlug.mockResolvedValue(brakes);
    const filtered = await loadListing(input({ surface: { kind: 'category', slug: 'brakes' }, searchParams: { brand: 'kestrel' } }));
    expect(filtered.kind).toBe('ok');
    const fitOnly = await loadListing(input({ surface: { kind: 'category', slug: 'brakes' } }));
    expect(fitOnly.kind).toBe('ok');
  });

  it('search with q sets the title data and relevance order', async () => {
    const view = ok(await loadListing(input({ surface: { kind: 'search' }, searchParams: { q: 'brake pads' } })));
    expect(view.params.q).toBe('brake pads');
    expect(view.sort).toBe('relevance');
  });

  it('an empty search is a prompt without a search call', async () => {
    expect(await loadListing(input({ surface: { kind: 'search' }, searchParams: { q: '   ' } }))).toMatchObject({ kind: 'prompt' });
    expect(searchParts).not.toHaveBeenCalled();
    expect(getShellContext).not.toHaveBeenCalled();
  });

  it('part number search puts the exact part first with its badge', async () => {
    getActiveVehicle.mockResolvedValue(golf);
    searchParts.mockResolvedValue({ ids: ['exact', 'other'], total: 2, facets: [] });
    getListingProjections.mockResolvedValue([
      { projection: projection('exact', 'MLV-BP-41005', [{ name: 'fitment-keys', value: ['Ford|F-150|2015|2020|5.0 V8'] }]), prices: [usd(6990)] },
      { projection: projection('other', 'MLV-BP-41001', fitting), prices: [usd(5490)] },
    ]);
    const view = ok(await loadListing(input({ surface: { kind: 'search' }, searchParams: { q: 'MLV-BP-41005' } })));
    expect(view.items.map((i) => [i.product.id, i.fit])).toEqual([['exact', 'does-not-fit'], ['other', 'fits']]);
  });
});

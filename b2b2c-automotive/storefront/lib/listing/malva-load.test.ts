// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCategoryBySlug = vi.hoisted(() => vi.fn());
const searchMalvaProducts = vi.hoisted(() => vi.fn());
const getActiveVehicle = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ct/categories', () => ({ getCategoryBySlug }));
vi.mock('@/lib/ct/malva-catalog', () => ({ searchMalvaProducts }));
vi.mock('@/lib/vehicles/active', () => ({ getActiveVehicle }));

import { loadMalvaListing } from './malva-load';

const category = { id: 'c-brakes', slug: 'brakes', name: 'Brakes', ancestors: [] };
const result = (total: number) => ({ items: [], total, page: 1, totalPages: Math.max(1, Math.ceil(total / 24)), facets: [] });

beforeEach(() => {
  getCategoryBySlug.mockReset();
  searchMalvaProducts.mockReset();
  getActiveVehicle.mockReset();
  getActiveVehicle.mockResolvedValue(null);
  getCategoryBySlug.mockResolvedValue(category);
  searchMalvaProducts.mockResolvedValue(result(30));
});

describe('Malva listing load: unknown category and paging', () => {
  it('an unknown slug is not-found and nothing is searched', async () => {
    getCategoryBySlug.mockResolvedValue(null);
    expect(await loadMalvaListing({ locale: 'en-US', slug: 'nope', searchParams: {} })).toEqual({ kind: 'not-found' });
    expect(searchMalvaProducts).not.toHaveBeenCalled();
  });
  it('a category searches the whole catalog by its id and reports the page', async () => {
    const view = await loadMalvaListing({ locale: 'en-US', slug: 'brakes', searchParams: { brand: 'vektra' } });
    expect(view).toMatchObject({ kind: 'ok', category, fitScopeOn: false, result: { total: 30 } });
    expect(searchMalvaProducts).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en-US', categoryId: 'c-brakes', fitKeys: null }));
  });
  it('a page past the last one asks for a redirect to the last page', async () => {
    const view = await loadMalvaListing({ locale: 'en-US', slug: 'brakes', searchParams: { page: '9' } });
    expect(view).toMatchObject({ kind: 'redirect', page: 2 });
  });
  it('an empty category is an ok page with no items', async () => {
    searchMalvaProducts.mockResolvedValue(result(0));
    expect(await loadMalvaListing({ locale: 'en-US', slug: 'brakes', searchParams: {} })).toMatchObject({ kind: 'ok', result: { total: 0 } });
  });
  it('a failing search throws so error.tsx answers', async () => {
    searchMalvaProducts.mockRejectedValue(new Error('down'));
    await expect(loadMalvaListing({ locale: 'en-US', slug: 'brakes', searchParams: {} })).rejects.toThrow('down');
  });
});

describe('Malva listing load: fit scope', () => {
  const vehicle = { label: '2015 Golf', fitKeys: ['VW|Golf|2012|2019|2.0 TDI'] };
  it('a garage vehicle scopes the search and fit=0 shows the whole category', async () => {
    getActiveVehicle.mockResolvedValue(vehicle);
    expect(await loadMalvaListing({ locale: 'en-US', slug: 'brakes', searchParams: {} })).toMatchObject({ fitScopeOn: true, vehicleLabel: '2015 Golf' });
    expect(searchMalvaProducts).toHaveBeenLastCalledWith(expect.objectContaining({ fitKeys: vehicle.fitKeys }));
    expect(await loadMalvaListing({ locale: 'en-US', slug: 'brakes', searchParams: { fit: '0' } })).toMatchObject({ fitScopeOn: false });
  });
  it('without a vehicle there is no fit scope', async () => {
    expect(await loadMalvaListing({ locale: 'en-US', slug: 'brakes', searchParams: {} })).toMatchObject({ fitScopeOn: false });
  });
});

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const storesGet = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ apiRoot: { stores: () => ({ get: (args: unknown) => ({ execute: () => storesGet(args) }) }) }, projectKey: 'p' }));

const branchChannel = (key: string, city: string, lng: number, lat: number) => ({
  id: `id-${key}`,
  key,
  name: { 'de-DE': `Filiale ${city}`, 'en-US': `${city} branch` },
  address: { country: 'DE', city, postalCode: '20095', streetName: 'Weg 1' },
  geoLocation: { type: 'Point', coordinates: [lng, lat] },
  custom: { type: { typeId: 'type', id: 't' }, fields: { openingHours: '{}', pickupMode: 'same-day', timezone: 'Europe/Berlin' } },
});
const retail = { id: 'id-retail', key: 'mau-retail', name: { 'en-US': 'Retail' } };
const store = (key: string, over: Record<string, unknown> = {}) => ({
  id: `store-id-${key}`,
  key,
  version: 3,
  name: { 'de-DE': `Name ${key}`, 'en-US': `Name EN ${key}` },
  countries: [{ code: 'DE' }],
  distributionChannels: [{ typeId: 'channel', id: 'id-retail', obj: retail }, { typeId: 'channel', id: 'id-br', obj: branchChannel('mau-br-1', 'Hamburg', 9.99, 53.55) }],
  supplyChannels: [{ typeId: 'channel', id: 'sc' }],
  productSelections: [{ productSelection: { typeId: 'product-selection', id: 'sel-secret' }, active: true }],
  custom: { type: { typeId: 'type', id: 't' }, fields: { addressLine: 'Hafenallee 12', postalCode: '21079', city: 'Hamburg', latitude: 53.46, longitude: 9.98, ownerBusinessUnitKey: 'mau-bu-north', freeShippingThresholdCent: 15000 } },
  ...over,
});

const load = () => import('./resellers');

beforeEach(() => {
  vi.resetModules();
  storesGet.mockReset();
});

describe('Reseller list: listResellers', () => {
  it('reads all stores with the distribution channels expanded', async () => {
    storesGet.mockResolvedValue({ body: { results: [store('mau-reseller-north')] } });
    await (await load()).listResellers('en-US');
    expect(storesGet).toHaveBeenCalledWith({ queryArgs: { expand: ['distributionChannels[*]'], sort: 'key asc', limit: 500 } });
  });
  it('a store without a distribution channel is dropped', async () => {
    storesGet.mockResolvedValue({ body: { results: [store('mau-reseller-north'), store('mau-empty', { distributionChannels: [] })] } });
    expect((await (await load()).listResellers('en-US')).map((r) => r.key)).toEqual(['mau-reseller-north']);
  });
  it('maps name, address, coordinates and branches (without the retail channel)', async () => {
    storesGet.mockResolvedValue({ body: { results: [store('mau-reseller-north')] } });
    expect(await (await load()).listResellers('de-DE')).toEqual([
      {
        key: 'mau-reseller-north',
        name: 'Name mau-reseller-north',
        city: 'Hamburg',
        postalCode: '21079',
        address: 'Hafenallee 12',
        lat: 53.46,
        lng: 9.98,
        branches: [{ key: 'mau-br-1', name: 'Filiale Hamburg', city: 'Hamburg', lat: 53.55, lng: 9.99 }],
      },
    ]);
  });
  it('the payload has only the listed fields and no id of a store, channel or selection', async () => {
    storesGet.mockResolvedValue({ body: { results: [store('mau-reseller-north')] } });
    const list = await (await load()).listResellers('en-US');
    expect(Object.keys(list[0]).sort()).toEqual(['address', 'branches', 'city', 'key', 'lat', 'lng', 'name', 'postalCode']);
    expect(Object.keys(list[0].branches[0]).sort()).toEqual(['city', 'key', 'lat', 'lng', 'name']);
    const text = JSON.stringify(list);
    expect(text).not.toMatch(/store-id|id-br|id-retail|sel-secret|mau-bu-north|15000|version/);
  });
  it('missing settings give empty strings and no coordinates, never a throw', async () => {
    storesGet.mockResolvedValue({ body: { results: [store('mau-bare', { custom: undefined })] } });
    expect(await (await load()).listResellers('en-US')).toMatchObject([{ key: 'mau-bare', city: '', postalCode: '', address: '', lat: undefined, lng: undefined }]);
  });
  it('is cached for 60 seconds and shared by locales', async () => {
    storesGet.mockResolvedValue({ body: { results: [store('mau-reseller-north')] } });
    const { listResellers } = await load();
    await listResellers('en-US');
    const de = await listResellers('de-DE');
    expect(storesGet).toHaveBeenCalledTimes(1);
    expect(de[0].name).toBe('Name mau-reseller-north');
  });
  it('serves the last known list during an outage and throws without one', async () => {
    vi.useFakeTimers();
    try {
      storesGet.mockResolvedValueOnce({ body: { results: [store('mau-reseller-north')] } });
      const { listResellers } = await load();
      const first = await listResellers('en-US');
      vi.advanceTimersByTime(61_000);
      storesGet.mockRejectedValue(new Error('down'));
      expect(await listResellers('en-US')).toEqual(first);
      vi.resetModules();
      await expect((await load()).listResellers('en-US')).rejects.toThrow('down');
    } finally {
      vi.useRealTimers();
    }
  });
});

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const projectionsGet = vi.hoisted(() => vi.fn());
const inventoryGet = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({
  apiRoot: {
    productProjections: () => ({ get: (a: unknown) => ({ execute: () => projectionsGet(a) }) }),
    inventory: () => ({ get: (a: unknown) => ({ execute: () => inventoryGet(a) }) }),
  },
  projectKey: 'p',
}));

import { bundleAvailability, getBundleView } from './bundles';

const bundle = { masterVariant: { attributes: [{ name: 'component-skus', value: ['SK-1', 'SK-2'] }, { name: 'component-quantities', value: ['SK-1:2', 'SK-2:1'] }] } };
const inStore = (...skus: string[]) => ({ body: { results: skus.map((sku) => ({ masterVariant: { sku }, name: { 'en-US': `Part ${sku}` } })) } });
const stock = (entries: [string, number, string?][]) => ({ body: { results: entries.map(([sku, availableQuantity, channel]) => ({ sku, availableQuantity, ...(channel ? { supplyChannel: { id: channel } } : { supplyChannel: { key: 'mau-supply-malva-dc' } }) })) } });

beforeEach(() => {
  projectionsGet.mockReset();
  inventoryGet.mockReset();
});

describe('bundleAvailability (W-11)', () => {
  it('is the minimum over the components of available divided by quantity (branch plus warehouse)', async () => {
    projectionsGet.mockResolvedValue(inStore('SK-1', 'SK-2'));
    inventoryGet.mockResolvedValue(stock([['SK-1', 3, 'ch-b'], ['SK-1', 3], ['SK-2', 9]]));
    expect(await bundleAvailability('mau-reseller-north', bundle, { branchChannelId: 'ch-b' })).toBe(3);
    expect(projectionsGet.mock.calls[0][0].queryArgs).toMatchObject({ storeProjection: 'mau-reseller-north' });
    expect(projectionsGet.mock.calls[0][0].queryArgs.where).toBe('masterVariant(sku in ("SK-1","SK-2"))');
  });
  it('is 0 when a component is not in the store selection (withdrawn), whatever the stock', async () => {
    projectionsGet.mockResolvedValue(inStore('SK-1'));
    inventoryGet.mockResolvedValue(stock([['SK-1', 50], ['SK-2', 50]]));
    expect(await bundleAvailability('mau-reseller-north', bundle)).toBe(0);
  });
  it('is 0 when a component has no stock record', async () => {
    projectionsGet.mockResolvedValue(inStore('SK-1', 'SK-2'));
    inventoryGet.mockResolvedValue(stock([['SK-1', 50]]));
    expect(await bundleAvailability('mau-reseller-north', bundle)).toBe(0);
  });
  it('is 0 for a product that is not a bundle and reads nothing', async () => {
    expect(await bundleAvailability('mau-reseller-north', { masterVariant: { attributes: [] } })).toBe(0);
    expect(projectionsGet).not.toHaveBeenCalled();
    expect(inventoryGet).not.toHaveBeenCalled();
  });
});

describe('getBundleView', () => {
  it('lists the components with their names and the available count', async () => {
    projectionsGet.mockResolvedValue(inStore('SK-1', 'SK-2'));
    inventoryGet.mockResolvedValue(stock([['SK-1', 4], ['SK-2', 1]]));
    const view = await getBundleView('mau-reseller-north', 'en-US', [{ sku: 'SK-1', qty: 2 }, { sku: 'SK-2', qty: 1 }]);
    expect(view).toEqual({
      components: [
        { sku: 'SK-1', qty: 2, name: 'Part SK-1', inStore: true },
        { sku: 'SK-2', qty: 1, name: 'Part SK-2', inStore: true },
      ],
      available: 1,
    });
  });
  it('a component outside the store is flagged and makes the bundle unavailable', async () => {
    projectionsGet.mockResolvedValue(inStore('SK-1'));
    inventoryGet.mockResolvedValue(stock([['SK-1', 4], ['SK-2', 4]]));
    const view = await getBundleView('mau-reseller-north', 'en-US', [{ sku: 'SK-1', qty: 1 }, { sku: 'SK-2', qty: 1 }]);
    expect(view.available).toBe(0);
    expect(view.components[1]).toMatchObject({ sku: 'SK-2', inStore: false, name: 'SK-2' });
  });
});

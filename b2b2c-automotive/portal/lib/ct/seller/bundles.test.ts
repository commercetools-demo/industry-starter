/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWFake, type WFake } from '@/lib/portal/w-fixture-root';
import { clearCatalogCaches } from './catalog-data';

let fake: WFake;
vi.mock('./catalog-root', () => ({ catalogRoot: async () => fake.root }));
vi.mock('./w-root', () => ({ wRoot: async () => fake.root }));

import { assignProducts, onAssortmentChanged, withdrawProducts } from './assortment-write';
import { createBundle, listBundles, publishBundle, reconcileBundles } from './bundles';

const NORTH = 'mau-reseller-north';
const SOUTH = 'mau-reseller-south';
const SKU = 'BND-MAU-RESELLER-NORTH-001';
const input = { name: 'TST-W bundle', discountPercent: 10, components: [{ sku: 'MLV-BP-41001', qty: 1 }, { sku: 'MLV-BD-42001', qty: 2 }] };

beforeEach(() => {
  fake = createWFake();
  clearCatalogCaches();
  onAssortmentChanged.length = 0;
});

const bundleProduct = () => [...fake.state.products.values()].find((p) => p.masterVariant.sku === SKU);
const inSelection = (id: string) => fake.state.selections.get('mau-sel-north')?.products.has(id) as boolean;

describe('bundle component not assigned', () => {
  it('creates an unpublished draft with the type attributes, no embedded price and ONE standalone price on the distribution channel', async () => {
    const view = await createBundle(NORTH, input);
    const p = bundleProduct();
    expect(p).toMatchObject({ published: false, productType: { id: 'pt-bundle' }, priceMode: 'Standalone' });
    const attrs = Object.fromEntries(p?.masterVariant.attributes.map((a: { name: string; value: unknown }) => [a.name, a.value]));
    expect(attrs).toEqual({
      'part-number': SKU,
      'component-skus': ['MLV-BP-41001', 'MLV-BD-42001'],
      'component-quantities': ['MLV-BP-41001:1', 'MLV-BD-42001:2'],
      'bundle-discount-percent': 10,
      'owner-store': NORTH,
    });
    expect(p?.masterVariant.prices).toBeUndefined();
    const prices = [...fake.state.prices.values()].filter((x) => x.sku === SKU);
    expect(prices).toHaveLength(1);
    expect(prices[0]).toMatchObject({ key: `${SKU}__mau-dist-north`, value: { centAmount: 21060, currencyCode: 'EUR' } }); // 9000 + 2 x 7200 = 23400, minus 10 percent
    expect(prices[0].channel.id).toBe('ch-mau-dist-north');
    expect(view).toMatchObject({ sku: SKU, status: 'Draft', componentsCents: 23400, bundleCents: 21060, savingCents: 2340, unavailableSku: null });
    expect(inSelection(p?.id)).toBe(false);
  });

  it('a component outside the assortment is a 409 naming the SKU and nothing is created', async () => {
    fake.resetCalls();
    await expect(createBundle(NORTH, { ...input, components: [{ sku: 'MLV-BP-41001', qty: 1 }, { sku: 'MLV-EX-52001', qty: 1 }] })).rejects.toMatchObject({ status: 409, code: 'COMPONENT_NOT_ASSIGNED', details: { sku: 'MLV-EX-52001' } });
    expect(fake.writes()).toHaveLength(0);
    expect(bundleProduct()).toBeUndefined();
  });

  it('sanity limits: 60 percent, one component, a long quantity are refused before anything is written; there is no floor', async () => {
    for (const bad of [{ discountPercent: 60 }, { components: [{ sku: 'MLV-BP-41001', qty: 1 }] }, { components: [{ sku: 'MLV-BP-41001', qty: 21 }, { sku: 'MLV-BD-42001', qty: 1 }] }]) {
      await expect(createBundle(NORTH, { ...input, ...bad })).rejects.toMatchObject({ status: 400 });
    }
    expect(fake.writes()).toHaveLength(0);
    // 50 percent (a price far below the components) is allowed
    await expect(createBundle(NORTH, { ...input, discountPercent: 50 })).resolves.toMatchObject({ bundleCents: 11700 });
  });

  it('publish rechecks the components, publishes and puts the bundle into the store selection; another store gets 404', async () => {
    const view = await createBundle(NORTH, input);
    await expect(publishBundle(SOUTH, view.key)).rejects.toMatchObject({ status: 404 });
    expect(bundleProduct()?.published).toBe(false);
    // a component withdrawn before publishing blocks it
    await withdrawProducts(NORTH, [fake.ids.sku('MLV-BD-42001')], { confirm: true, expectedCount: 1 });
    await expect(publishBundle(NORTH, view.key)).rejects.toMatchObject({ status: 409, code: 'COMPONENT_NOT_ASSIGNED', details: { sku: 'MLV-BD-42001' } });
    await assignProducts(NORTH, [fake.ids.sku('MLV-BD-42001')]);
    const live = await publishBundle(NORTH, view.key);
    expect(live.status).toBe('Live');
    expect(inSelection(bundleProduct()?.id)).toBe(true);
  });
});

describe('bundle hidden on withdrawal', () => {
  it('withdrawing a component removes the bundle from the store selection, reinstating restores it, and the list says why', async () => {
    onAssortmentChanged.push(async (store) => void (await reconcileBundles(store)));
    const view = await createBundle(NORTH, input);
    await publishBundle(NORTH, view.key);
    const id = bundleProduct()?.id;
    expect(inSelection(id)).toBe(true);

    await withdrawProducts(NORTH, [fake.ids.sku('MLV-BD-42001')], { confirm: true, expectedCount: 1 });
    expect(inSelection(id)).toBe(false);
    const hidden = (await listBundles(NORTH))[0];
    expect(hidden).toMatchObject({ status: 'Live', unavailableSku: 'MLV-BD-42001' });

    await assignProducts(NORTH, [fake.ids.sku('MLV-BD-42001')]);
    expect(inSelection(id)).toBe(true);
    expect((await listBundles(NORTH))[0].unavailableSku).toBeNull();
  });

  it('the list reconciles by itself, and a draft is never put into the selection', async () => {
    const view = await createBundle(NORTH, input);
    await publishBundle(NORTH, view.key);
    await withdrawProducts(NORTH, [fake.ids.sku('MLV-BD-42001')], { confirm: true, expectedCount: 1 }); // no hook registered here
    expect(inSelection(bundleProduct()?.id)).toBe(true);
    await listBundles(NORTH);
    expect(inSelection(bundleProduct()?.id)).toBe(false);
    expect(await reconcileBundles(SOUTH)).toEqual({ hidden: [], restored: [] });
  });

  it("another store's list never shows the bundle", async () => {
    await createBundle(NORTH, input);
    expect(await listBundles(SOUTH)).toEqual([]);
    expect((await listBundles(NORTH)).map((b) => b.sku)).toEqual([SKU]);
  });
});

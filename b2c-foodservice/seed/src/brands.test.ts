// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { CHANNEL_DRINKS, SELECTION_COFFEE, SELECTION_DRINKS } from './data/brands';
import { BRAND_VALUES, typeDrafts } from './data/custom-types';
import { DRINK_LINES, DRINK_PRODUCT_KEYS, drinkProductDrafts, parseSize, priceUsd } from './data/drinks';
import { PRODUCTS } from './data/products';
import { FakeApi } from './fake-api';
import { Runner } from './lib';
import { runSeed } from './seed';
import { verifySeed } from './verify';

const quiet = () => undefined;
const seeded = async (): Promise<FakeApi> => {
  const api = new FakeApi();
  await runSeed({ api, run: new Runner(false, quiet), demoPassword: 'dummy-long-demo-password' });
  return api;
};

describe('Multibrand seed', () => {
  it('adds the brand field to the existing line type and creates no new type', () => {
    const line = typeDrafts.find((t) => t.key === 'mcf-line-fulfilment');
    const brand = line?.fieldDefinitions?.find((f) => f.name === 'brand');
    expect(brand?.type).toMatchObject({ name: 'Enum' });
    expect(((brand?.type as { values: { key: string }[] }).values).map((v) => v.key)).toEqual([...BRAND_VALUES]);
    expect(typeDrafts.map((t) => t.key).sort()).toEqual(['instore-order-type', 'mcf-line-fulfilment', 'mcf-review', 'mcf-store']);
  });

  it('adds brand to a type that lacks it (update, not a new type)', async () => {
    const api = new FakeApi();
    api.put('types', { key: 'mcf-line-fulfilment', resourceTypeIds: ['line-item'], fieldDefinitions: [{ name: 'fulfilment', type: { name: 'Enum', values: [] } }] });
    await runSeed({ api, run: new Runner(false, quiet), demoPassword: 'dummy-long-demo-password' });
    const types = api.all('types').filter((t) => t.key === 'mcf-line-fulfilment');
    expect(types).toHaveLength(1);
    expect((types[0]?.fieldDefinitions as { name: string }[]).map((f) => f.name)).toContain('brand');
  });

  it('puts every coffee product in the coffee selection and every drink in the drinks selection', async () => {
    const api = await seeded();
    const idOf = (key: string) => api.all('products').find((p) => p.key === key)?.id;
    const coffee = new Set(await api.selectionProductIds(api.all('product-selections').find((s) => s.key === SELECTION_COFFEE)?.id ?? ''));
    const drinks = new Set(await api.selectionProductIds(api.all('product-selections').find((s) => s.key === SELECTION_DRINKS)?.id ?? ''));
    for (const p of PRODUCTS) expect(coffee.has(idOf(p.key) ?? ''), p.key).toBe(true);
    for (const k of DRINK_PRODUCT_KEYS) expect(drinks.has(idOf(k) ?? ''), k).toBe(true);
    for (const id of drinks) expect(coffee.has(id)).toBe(false);
  });

  it('a second run changes nothing and verify is clean', async () => {
    const api = await seeded();
    const writes = api.writes;
    const run = new Runner(false, quiet);
    await runSeed({ api, run, demoPassword: 'dummy-long-demo-password' });
    expect(run.changes).toBe(0);
    expect(api.writes).toBe(writes);
    expect(await verifySeed(api)).toEqual([]);
  });

  it('stocks drinks only on the drinks channel, and the channel is not a store', async () => {
    const api = await seeded();
    const channel = api.all('channels').find((c) => c.key === CHANNEL_DRINKS);
    expect(channel).toBeTruthy();
    expect(String(channel?.key).startsWith('mcf-store-')).toBe(false);
    const entries = api.all('inventory').filter((i) => DRINK_LINES.some((l) => l.sku === i.sku));
    expect(entries).toHaveLength(DRINK_LINES.length);
    for (const e of entries) expect((e.supplyChannel as { id: string }).id).toBe(channel?.id);
  });

  it('seeds drinks images from the scraped URLs as they are', () => {
    const drafts = drinkProductDrafts();
    const variants = drafts.flatMap((d) => [d.masterVariant, ...(d.variants as unknown[])] as { sku: string; images?: { url: string }[] }[]);
    for (const line of DRINK_LINES) {
      const v = variants.find((x) => x.sku === line.sku);
      expect((v?.images ?? []).map((i) => i.url)).toEqual(line.images);
    }
  });

  it('reads pack and volume from the size text and prices in multiples of 5', () => {
    expect(parseSize('6-11.15 FL OZ (330 mL) CANS (66.9 FL OZ [2.09 QT] [1.98 L] TOTAL)')).toEqual({ count: 6, floz: 11.15 });
    expect(parseSize('11.15 fl oz Can (24 count)')).toEqual({ count: 24, floz: 11.15 });
    expect(parseSize('11.15 fl oz Can 8 Pack')).toEqual({ count: 8, floz: 11.15 });
    expect(parseSize('16.9 fl oz bottle')).toEqual({ count: 1, floz: 16.9 });
    for (const l of DRINK_LINES) expect(priceUsd(l) % 5).toBe(0);
  });
});

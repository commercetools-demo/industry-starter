// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import type { Res } from './api';
import { K } from './data/base';
import { LOW_STOCK_THRESHOLD, inventoryKey } from './data/extras';
import { OUT_OF_STOCK_AT_STORE, PRODUCTS, allVariants, productByCode } from './data/products';
import { STORES } from './data/stores';
import { FakeApi } from './fake-api';
import { Runner } from './lib';
import { runSeed } from './seed';

const quiet = () => undefined;
const seeded = async (): Promise<FakeApi> => {
  const api = new FakeApi();
  await runSeed({ api, run: new Runner(false, quiet), demoPassword: 'dummy-long-demo-password' });
  return api;
};
const qty = (api: FakeApi, sku: string, store?: string): number | undefined => api.all('inventory').find((i) => i.key === inventoryKey(sku, store))?.quantityOnStock as number | undefined;
const km = (a: [number, number], b: [number, number]): number => {
  const rad = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(rad(b[1] - a[1]) / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(rad(b[0] - a[0]) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

describe('Stores are supply channels', () => {
  it('Store list', async () => {
    const api = await seeded();
    api.put('channels', { key: 'warehouse-hand-made', roles: ['ProductDistribution'], name: { 'en-US': 'Hand made' } });
    const picker = api.all('channels').filter((c) => ((c.roles as string[]) ?? []).includes('InventorySupply'));
    expect(picker.map((c) => c.key).sort()).toEqual(STORES.map((s) => s.key).sort());
    expect(picker).toHaveLength(6);
    // nearest first: from Times Square the Midtown East store leads, from Brooklyn Heights the Williamsburg store
    const near = (origin: [number, number]) => [...picker].sort((a, b) => km(origin, (a.geoLocation as { coordinates: [number, number] }).coordinates) - km(origin, (b.geoLocation as { coordinates: [number, number] }).coordinates))[0]?.key;
    expect(near([-73.9855, 40.758])).toBe('mcf-store-midtown-east');
    expect(near([-73.9442, 40.7081])).toBe('mcf-store-brooklyn-williamsburg');
    // each store carries address, hours and phone in custom fields, and the country it serves
    for (const c of picker) {
      const fields = (c.custom as { fields: Record<string, unknown> }).fields;
      expect(Object.keys(fields).sort()).toEqual(['addressLine', 'city', 'collectionMinutes', 'hours', 'phone', 'postalCode']);
      expect(JSON.parse(fields.hours as string).sun).toBeTruthy();
      expect((c.address as { country: string }).country).toBe('US');
    }
    expect(new Set(picker.map((c) => JSON.stringify((c.custom as { fields: { hours: string } }).fields.hours))).size).toBeGreaterThan(2); // hours differ per store
  });
});

describe('Availability per store', () => {
  it('Collect at an empty store', async () => {
    const api = await seeded();
    expect(OUT_OF_STOCK_AT_STORE.codes).toHaveLength(2);
    for (const code of OUT_OF_STOCK_AT_STORE.codes) {
      for (const v of productByCode(code).variants) {
        expect(qty(api, v.sku, OUT_OF_STOCK_AT_STORE.store), v.sku).toBe(0); // not collectable there
        expect(qty(api, v.sku) ?? 0, v.sku).toBeGreaterThan(0); // still available to ship (online entry without channel)
      }
    }
  });

  it('stock is deterministic, has a handful of zeros and some low-stock entries, and every variant has an online entry and one per store', async () => {
    const api = await seeded();
    const again = await seeded();
    expect(api.all('inventory').map((i) => `${String(i.key)}=${String(i.quantityOnStock)}`)).toEqual(again.all('inventory').map((i) => `${String(i.key)}=${String(i.quantityOnStock)}`));
    const variants = allVariants();
    expect(api.all('inventory')).toHaveLength(variants.length * 7);
    const storeEntries = api.all('inventory').filter((i) => i.supplyChannel);
    expect(storeEntries.filter((i) => i.quantityOnStock === 0).length).toBeGreaterThanOrEqual(5);
    expect(storeEntries.filter((i) => (i.quantityOnStock as number) > 0 && (i.quantityOnStock as number) <= LOW_STOCK_THRESHOLD).length).toBeGreaterThanOrEqual(5);
    for (const { variant } of variants) {
      expect(qty(api, variant.sku)).toBeGreaterThan(0);
      for (const s of STORES) expect(qty(api, variant.sku, s.key), `${variant.sku}@${s.key}`).toBeDefined();
    }
  });
});

describe('Fulfilment per line', () => {
  it('Collect line', async () => {
    // The data a collect line needs: the store as supplyChannel (an InventorySupply channel), the line custom field
    // `fulfilment` with the value `collect`, and the zero-rate collect shipping method.
    const api = await seeded();
    const type = (await api.getByKey('types', K.typeLine)) as Res;
    expect(type.resourceTypeIds).toEqual(['line-item']);
    const field = (type.fieldDefinitions as { name: string; type: { name: string; values: { key: string }[] } }[]).find((f) => f.name === 'fulfilment');
    expect(field?.type.name).toBe('Enum');
    expect(field?.type.values.map((v) => v.key)).toEqual(['collect', 'delivery', 'subscribe']);
    const store = (await api.getByKey('channels', STORES[0]?.key as string)) as Res;
    expect(store.roles).toEqual(['InventorySupply']);
    const collect = (await api.getByKey('shipping-methods', K.shipCollect)) as Res;
    for (const zr of collect.zoneRates as { shippingRates: { price: { centAmount: number } }[] }[]) expect(zr.shippingRates[0]?.price.centAmount).toBe(0);
  });

  it.todo('Mixed order (one payment and two shipping groups through the hosted Checkout, verified in workstream J)');
});

describe('Order states for collection', () => {
  it('Ready', async () => {
    const api = await seeded();
    const keys = [K.orderOrdered, K.orderPreparing, K.orderReady, K.orderCollected];
    const states = await Promise.all(keys.map(async (k) => (await api.getByKey('states', k)) as Res));
    expect(states.every((s) => s.type === 'OrderState')).toBe(true);
    expect(states.map((s) => s.initial)).toEqual([true, false, false, false]);
    // transitions in order: ordered > preparing > ready > collected, so the tracker can read the state
    for (let i = 0; i < 3; i += 1) expect((states[i]?.transitions as { id: string }[]).map((t) => t.id)).toEqual([states[i + 1]?.id]);
    expect(states[3]?.transitions ?? []).toEqual([]);
    expect(((states[2]?.name) as Record<string, string>)['en-US']).toBe('Ready for collection');
  });
});

describe('Subscriptions', () => {
  it.todo('Recurring order creation fails (checkout behaviour, verified in the storefront order workstream)');

  it('subscribe is offered only where a variant has a recurring price for a recurrence policy', async () => {
    const api = await seeded();
    const policies = new Map(api.all('recurrence-policies').map((p) => [p.id, p.key]));
    expect([...policies.values()].sort()).toEqual([K.rpEvery2Months, K.rpEvery2Weeks, K.rpEvery3Months, K.rpEveryMonth].sort());
    for (const def of PRODUCTS) {
      const p = (await api.getByKey('products', def.key)) as Res;
      const md = p.masterData as { current: { masterVariant: { recurrencePrices: unknown[]; prices: unknown[] }; variants: { recurrencePrices: unknown[]; prices: unknown[] }[] } };
      for (const v of [md.current.masterVariant, ...md.current.variants]) {
        expect(v.prices, def.key).toHaveLength(2);
        expect(v.recurrencePrices.length, def.key).toBe(def.subscribable ? 8 : 0);
      }
    }
    expect(PRODUCTS.filter((p) => p.subscribable).length).toBeGreaterThanOrEqual(15);
    // subscribable products are food (pods and coffee) only
    expect(PRODUCTS.filter((p) => p.subscribable).every((p) => p.kind === 'pods' || p.kind === 'coffee')).toBe(true);
  });
});

describe('Shipping by market', () => {
  it('Threshold per market', async () => {
    const api = await seeded();
    const standard = (await api.getByKey('shipping-methods', K.shipStandard)) as Res;
    const zones = new Map(api.all('zones').map((z) => [z.id, z.key]));
    const rates = Object.fromEntries((standard.zoneRates as { zone: { id: string }; shippingRates: { price: { centAmount: number; currencyCode: string }; freeAbove: { centAmount: number; currencyCode: string } }[] }[]).map((z) => [zones.get(z.zone.id), z.shippingRates[0]]));
    // each market has its own free-shipping threshold and currency, read from the rate, not from front-end constants
    expect(rates[K.zoneUs]).toMatchObject({ price: { centAmount: 695, currencyCode: 'USD' }, freeAbove: { centAmount: 7500, currencyCode: 'USD' } });
    expect(rates[K.zoneCa]).toMatchObject({ price: { centAmount: 895, currencyCode: 'CAD' }, freeAbove: { centAmount: 9900, currencyCode: 'CAD' } });
    const express = (await api.getByKey('shipping-methods', K.shipExpress)) as Res;
    expect(JSON.stringify(express.zoneRates)).not.toContain('freeAbove');
    expect(JSON.stringify(express.zoneRates)).toContain('1495');
  });
});

describe('Tax by market', () => {
  it('US address without state rate', async () => {
    const api = await seeded();
    expect(api.project.carts?.countryTaxRateFallbackEnabled).toBe(true);
    const tax = (await api.getByKey('tax-categories', K.taxStandard)) as Res;
    const rates = tax.rates as { country: string; state?: string; amount: number; includedInPrice: boolean }[];
    // the rate the platform picks: the rate of the state when there is one, else the country rate without a state
    const pick = (country: string, state?: string) => rates.find((r) => r.country === country && r.state === state) ?? rates.find((r) => r.country === country && !r.state);
    expect(pick('US', 'NY')?.amount).toBe(0.08875);
    expect(pick('US', 'CA')?.amount).toBe(0.08); // California has no rate of its own: the country rate applies
    expect(pick('US')?.amount).toBe(0.08);
    expect(pick('CA')?.amount).toBe(0.05); // GST is a country-level rate: it applies to every Canadian province
  });

  it('uses the food category for pods and coffee and the standard category for machines, accessories and gifts; all rates tax-exclusive', async () => {
    const api = await seeded();
    const food = (await api.getByKey('tax-categories', K.taxFood)) as Res;
    const rate = (c: Res, country: string) => (c.rates as { country: string; amount: number; includedInPrice: boolean }[]).find((r) => r.country === country);
    expect([rate(food, 'US')?.amount, rate(food, 'CA')?.amount]).toEqual([0, 0]);
    const std = (await api.getByKey('tax-categories', K.taxStandard)) as Res;
    expect([rate(std, 'US')?.includedInPrice, rate(std, 'CA')?.includedInPrice]).toEqual([false, false]);
    const taxById = new Map(api.all('tax-categories').map((t) => [t.id, t.key]));
    for (const def of PRODUCTS) {
      const p = (await api.getByKey('products', def.key)) as Res;
      expect(taxById.get((p.taxCategory as { id: string }).id), def.key).toBe(def.kind === 'pods' || def.kind === 'coffee' ? K.taxFood : K.taxStandard);
    }
  });
});

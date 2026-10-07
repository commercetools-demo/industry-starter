import { describe, expect, it } from 'vitest';
import { applyPlan, newCtx, planAll } from '../reconcile';
import { FakeCt } from '../test/fake-ct';
import type { InventoryDraft, ProductDraft, ProductTypeDraft, SeedManifest } from '../types';
import { reconcilers } from './registry';

const label = (t: string) => ({ 'en-US': t, 'de-DE': t });

const productType: ProductTypeDraft = {
  key: 'malva-offer',
  name: 'Offer',
  description: 'd',
  attributes: [
    { name: 'offer-kind', label: label('Kind'), isRequired: true, type: { name: 'enum', values: [{ key: 'device', label: 'Device' }, { key: 'addon', label: 'Add-on' }] } },
  ],
};
const otherType: ProductTypeDraft = { ...productType, key: 'malva-other' };

function product(over: Partial<ProductDraft> = {}): ProductDraft {
  return {
    key: 'malva-offer-phone',
    productType: 'malva-offer',
    name: label('Phone'),
    slug: label('phone'),
    categories: ['malva-cat-devices'],
    categoryOrderHints: { 'malva-cat-devices': '0.1' },
    taxCategory: 'malva-telecom-services',
    publish: true,
    masterVariant: {
      sku: 'MLV-PHONE-1',
      attributes: [{ name: 'offer-kind', value: 'device' }],
      prices: [{ key: 'malva-price-phone-us', value: { currencyCode: 'USD', centAmount: 1000 }, country: 'US', customerGroup: 'consumer' }],
      images: [{ url: 'https://example.test/a.png', dimensions: { w: 10, h: 10 } }],
    },
    variants: [],
    ...over,
  };
}

const inventory: InventoryDraft = { key: 'malva-inv-MLV-PHONE-1', sku: 'MLV-PHONE-1', quantityOnStock: 5 };

function manifest(p: ProductDraft = product(), inv: InventoryDraft[] = [inventory], types = [productType, otherType]): SeedManifest {
  return {
    productType: types,
    taxCategory: [{ key: 'malva-telecom-services', name: 'T', rates: [] } as unknown as { key: string }],
    customerGroup: [{ key: 'consumer', groupName: 'Consumer' } as unknown as { key: string }],
    category: [{ key: 'malva-cat-devices', name: label('Devices'), slug: label('devices') } as unknown as { key: string }],
    product: [p],
    inventory: inv,
  };
}

async function run(api: FakeCt, m: SeedManifest) {
  const ctx = newCtx();
  const plan = await planAll(api, m, reconcilers, ctx);
  return applyPlan(api, m, plan, reconcilers, ctx);
}

async function seeded(): Promise<FakeCt> {
  const api = new FakeCt();
  const results = await run(api, manifest());
  expect(results.filter((r) => r.outcome.status === 'failed')).toEqual([]);
  api.log.length = 0;
  return api;
}

describe('product reconciler', () => {
  it('creates a published product and is idempotent', async () => {
    const api = await seeded();
    expect((api.byKey('products', 'malva-offer-phone')?.masterData as { published: boolean }).published).toBe(true);
    api.writes = 0;
    const results = await run(api, manifest());
    expect(api.writes).toBe(0);
    expect(results.every((r) => r.outcome.status === 'unchanged')).toBe(true);
  });

  it('price change: one setPrices for that SKU and one publish', async () => {
    const api = await seeded();
    const changed = product();
    changed.masterVariant.prices = [{ ...changed.masterVariant.prices[0], value: { currencyCode: 'USD', centAmount: 1200 } }];
    await run(api, manifest(changed));
    expect(api.log).toEqual(['update products malva-offer-phone setPrices,publish']);
  });

  it('name change: changeName only (then publish)', async () => {
    const api = await seeded();
    await run(api, manifest(product({ name: label('Phone 2') })));
    expect(api.log).toEqual(['update products malva-offer-phone changeName,publish']);
  });

  it('unpublished product: publish', async () => {
    const api = await seeded();
    const res = api.byKey('products', 'malva-offer-phone');
    (res?.masterData as { published: boolean }).published = false;
    await run(api, manifest());
    expect(api.log).toEqual(['update products malva-offer-phone publish']);
    expect((api.byKey('products', 'malva-offer-phone')?.masterData as { published: boolean }).published).toBe(true);
  });

  it('removed variant: removeVariant', async () => {
    const api = await seeded();
    const extra = product();
    extra.variants = [{ sku: 'MLV-PHONE-2', attributes: [{ name: 'offer-kind', value: 'device' }], prices: [] }];
    await run(api, manifest(extra));
    api.log.length = 0;
    await run(api, manifest(product()));
    expect(api.log).toEqual(['update products malva-offer-phone removeVariant,publish']);
  });

  it('attribute change: setAttribute', async () => {
    const api = await seeded();
    const changed = product();
    changed.masterVariant.attributes = [{ name: 'offer-kind', value: 'addon' }];
    await run(api, manifest(changed));
    expect(api.log).toEqual(['update products malva-offer-phone setAttribute,publish']);
  });

  it('product type change: conflict, nothing written', async () => {
    const api = await seeded();
    api.writes = 0;
    const results = await run(api, manifest(product({ productType: 'malva-other' })));
    const outcome = results.find((r) => r.kind === 'product')?.outcome;
    expect(outcome?.status).toBe('skipped');
    expect(api.writes).toBe(0);
  });

  it('category order hint change: setCategoryOrderHint', async () => {
    const api = await seeded();
    await run(api, manifest(product({ categoryOrderHints: { 'malva-cat-devices': '0.9' } })));
    expect(api.log).toEqual(['update products malva-offer-phone setCategoryOrderHint,publish']);
  });

  it('removes a product by unpublishing first', async () => {
    const api = await seeded();
    const reconciler = reconcilers.find((r) => r.kind === 'product');
    const existing = await reconciler?.fetch(api, 'malva-offer-phone');
    await reconciler?.remove(api, existing, newCtx());
    expect(api.log).toEqual(['update products malva-offer-phone unpublish', 'delete products malva-offer-phone']);
  });
});

describe('inventory reconciler', () => {
  it('quantity change: changeQuantity', async () => {
    const api = await seeded();
    await run(api, manifest(product(), [{ ...inventory, quantityOnStock: 9 }]));
    expect(api.log).toEqual(['update inventory malva-inv-MLV-PHONE-1 changeQuantity']);
  });

  it('a different sku for the same key is a conflict', async () => {
    const api = await seeded();
    const results = await run(api, manifest(product(), [{ ...inventory, sku: 'MLV-OTHER' }]));
    expect(results.find((r) => r.kind === 'inventory')?.outcome.status).toBe('skipped');
  });
});

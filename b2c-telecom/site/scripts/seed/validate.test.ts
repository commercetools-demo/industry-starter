import { describe, expect, it } from 'vitest';
import { FakeCt } from './test/fake-ct';
import type { AnyReconciler, Kind, ProductDraft, ProductTypeDraft, SeedManifest, Draft } from './types';
import { validateManifest } from './validate';

function refReconciler(kind: Kind, refs: (d: Draft) => { kind: Kind; key: string }[]): AnyReconciler {
  return {
    kind,
    order: 1,
    refs: (d) => refs(d).map((r) => ({ ...r, from: { kind, key: d.key } })),
    fetch: async () => null,
    create: async () => undefined,
    diff: () => ({ changes: [] }),
    update: async () => undefined,
    remove: async () => undefined,
  };
}

const productReconciler = refReconciler('product', (d) => {
  const p = d as ProductDraft;
  return [
    { kind: 'productType', key: p.productType },
    { kind: 'taxCategory', key: p.taxCategory },
  ];
});
const shippingReconciler = refReconciler('shippingMethod', () => []);

const type: ProductTypeDraft = {
  key: 'malva-offer',
  name: 'Offer',
  description: 'd',
  attributes: [
    { name: 'offer-kind', label: { 'en-US': 'Kind', 'de-DE': 'Art' }, isRequired: true, savedToLineItem: true, type: { name: 'enum', values: [{ key: 'addon', label: 'Add-on' }, { key: 'device', label: 'Device' }] } },
    { name: 'speed', label: { 'en-US': 'Speed', 'de-DE': 'Tempo' }, isRequired: false, type: { name: 'number' } },
  ],
};

function product(over: Partial<ProductDraft> = {}, sku = 'MLV-A'): ProductDraft {
  return {
    key: `malva-p-${sku}`,
    productType: 'malva-offer',
    name: { 'en-US': 'N', 'de-DE': 'N' },
    slug: { 'en-US': sku, 'de-DE': sku },
    categories: [],
    taxCategory: 'malva-telecom-services',
    publish: true,
    masterVariant: {
      sku,
      attributes: [{ name: 'offer-kind', value: 'device' }],
      prices: [{ key: `malva-price-${sku}`, value: { currencyCode: 'USD', centAmount: 100 } }],
    },
    variants: [],
    ...over,
  };
}

function manifest(products: ProductDraft[]): SeedManifest {
  return {
    productType: [type],
    taxCategory: [{ key: 'malva-telecom-services' }],
    product: products,
  };
}

describe('validateManifest', () => {
  it('Dangling reference caught before any write: names the missing key and the referrer, zero writes', async () => {
    const api = new FakeCt();
    const errors = await validateManifest(api, { product: [product({ productType: 'malva-missing' })] }, [productReconciler]);
    expect(errors.map((e) => e.message)).toContain(
      'Dangling reference: product "malva-p-MLV-A" references productType "malva-missing", which no manifest defines and the project does not hold',
    );
    expect(api.writes).toBe(0);
  });

  it('resolves references through the manifest', async () => {
    const api = new FakeCt();
    expect(await validateManifest(api, manifest([product()]), [productReconciler])).toEqual([]);
  });

  it('rejects a duplicate SKU', async () => {
    const api = new FakeCt();
    const dup = product({ key: 'malva-p-2' }, 'MLV-A');
    const errors = await validateManifest(api, manifest([product(), dup]), [productReconciler]);
    expect(errors.some((e) => e.message === 'Duplicate SKU "MLV-A"')).toBe(true);
  });

  it('rejects a duplicate price key', async () => {
    const api = new FakeCt();
    const other = product({}, 'MLV-B');
    other.masterVariant.prices[0].key = 'malva-price-MLV-A';
    const errors = await validateManifest(api, manifest([product(), other]), [productReconciler]);
    expect(errors.some((e) => e.message === 'Duplicate price key "malva-price-MLV-A"')).toBe(true);
  });

  it('rejects text without de-DE', async () => {
    const api = new FakeCt();
    const bad = product({ name: { 'en-US': 'Only English' } });
    const errors = await validateManifest(api, manifest([bad]), [productReconciler]);
    expect(errors.some((e) => e.message.startsWith('Missing de-DE text'))).toBe(true);
  });

  it('rejects an unknown enum value', async () => {
    const api = new FakeCt();
    const bad = product();
    bad.masterVariant.attributes = [{ name: 'offer-kind', value: 'spaceship' }];
    const errors = await validateManifest(api, manifest([bad]), [productReconciler]);
    expect(errors.some((e) => e.message.includes('unknown enum value "spaceship"') && e.message.includes('addon, device'))).toBe(true);
  });

  it('rejects a predicate attribute that is not saved to the line item', async () => {
    const api = new FakeCt();
    const m: SeedManifest = {
      ...manifest([product()]),
      shippingMethod: [{ key: 'malva-shipping-standard', predicate: 'attributes.`speed` = 1' } as Draft],
    };
    const errors = await validateManifest(api, m, [productReconciler, shippingReconciler]);
    expect(errors.some((e) => e.message.includes('attribute "speed"') && e.message.includes('savedToLineItem'))).toBe(true);
    const ok: SeedManifest = { ...manifest([product()]), shippingMethod: [{ key: 'malva-shipping-standard', predicate: 'attributes.`offer-kind` = "device"' } as Draft] };
    expect(await validateManifest(api, ok, [productReconciler, shippingReconciler])).toEqual([]);
  });

  it('rejects unowned keys', async () => {
    const api = new FakeCt();
    const errors = await validateManifest(api, { category: [{ key: 'furniture' }] }, []);
    expect(errors[0].message).toContain('not an owned key');
  });
});

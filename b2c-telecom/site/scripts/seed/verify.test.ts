import { describe, expect, it } from 'vitest';
import { buildPlatformManifest as buildManifest } from './manifest';
import { main as seedMain } from './seed';
import { FakeCt } from './test/fake-ct';
import type { CategoryDraft, ProductDraft, ProductTypeDraft, SeedManifest } from './types';
import { platformChecks } from './checks/platform';
import { main as verify } from './verify';

const SOURCE = { CTP_SEED_PROJECT_KEY: 'spec-test-b2c-telecom' };
const label = (t: string) => ({ 'en-US': t, 'de-DE': t });

const productType: ProductTypeDraft = { key: 'malva-offer', name: 'Offer',
  description: 'd',
  attributes: [
    {
      name: 'offer-kind',
      label: label('Kind'),
      isRequired: true,
      savedToLineItem: true,
      type: { name: 'enum', values: [{ key: 'device', label: 'Device' }] },
    },
  ],
};
const category: CategoryDraft = { key: 'malva-cat-devices', name: label('Devices'), slug: label('devices') };
const product: ProductDraft = {
  key: 'malva-offer-phone',
  productType: 'malva-offer',
  name: label('Phone'),
  slug: label('phone'),
  categories: ['malva-cat-devices'],
  taxCategory: 'malva-telecom-services',
  publish: true,
  masterVariant: { sku: 'MLV-PHONE', attributes: [{ name: 'offer-kind', value: 'device' }], prices: [{ key: 'malva-price-phone', value: { currencyCode: 'USD', centAmount: 100 } }] },
  variants: [],
};

function seededManifest(): SeedManifest {
  return { ...buildManifest(), productType: [productType], category: [category], product: [product] };
}

async function fullySeeded(): Promise<FakeCt> {
  const api = new FakeCt();
  api.seed('zones', { key: 'usa', name: 'usa', locations: [{ country: 'US' }] });
  api.seed('zones', { key: 'europe', name: 'europe', locations: [{ country: 'DE' }] });
  const code = await seedMain(['--confirm-project', 'spec-test-b2c-telecom', '--no-wait'], { api, source: SOURCE, manifest: seededManifest(), log: () => undefined });
  expect(code).toBe(0);
  return api;
}

async function run(api: FakeCt) {
  const lines: string[] = [];
  const code = await verify([], { api, source: SOURCE, checks: platformChecks, log: (l) => lines.push(l) });
  return { code, out: lines.join('\n') };
}

describe('seed:verify', () => {
  it('all checks pass on a fully seeded project', async () => {
    const api = await fullySeeded();
    const { code, out } = await run(api);
    expect(out).toContain('All checks passed.');
    expect(code).toBe(0);
    expect(api.writes).toBeGreaterThan(0); // seeding wrote; verify itself must not
  });

  it('never writes', async () => {
    const api = await fullySeeded();
    api.writes = 0;
    await run(api);
    expect(api.writes).toBe(0);
  });

  it('Every product taxable: tax category has US and DE rates and every product has a tax category', async () => {
    const api = await fullySeeded();
    expect((await run(api)).out).toMatch(/PASS\s+every product taxable/);
    api.seed('products', { key: 'malva-untaxed', productType: { typeId: 'product-type', id: api.byKey('product-types', 'malva-offer')?.id }, masterData: { published: true } });
    const { code, out } = await run(api);
    expect(code).toBe(1);
    expect(out).toMatch(/FAIL\s+every product taxable.*malva-untaxed/);
  });

  it('Storefront sees only the intended assortment: a published non-Malva product fails the check', async () => {
    const api = await fullySeeded();
    const furniture = api.seed('product-types', { key: 'furniture-and-decor', name: 'Furniture' });
    api.seed('products', { key: 'sofa', productType: { typeId: 'product-type', id: furniture.id }, taxCategory: { typeId: 'tax-category', id: 'x' }, masterData: { published: true } });
    const { code, out } = await run(api);
    expect(code).toBe(1);
    expect(out).toMatch(/FAIL\s+storefront sees only the intended assortment.*sofa \(furniture-and-decor\)/);
    expect(out).toMatch(/FAIL\s+furniture sample data removed/);
  });

  it('fails the search check with the remedy when indexing is deactivated', async () => {
    const api = await fullySeeded();
    (api.project.searchIndexing as { productsSearch: { status: string } }).productsSearch.status = 'Deactivated';
    const { out } = await run(api);
    expect(out).toMatch(/FAIL\s+product search active.*npm run seed:settings -- --confirm-project spec-test-b2c-telecom/);
  });

  it('fails on a missing shipping method and a non-zero rate', async () => {
    const api = await fullySeeded();
    const m = api.byKey('shipping-methods', 'malva-delivery-digital');
    const rate = (m?.zoneRates as { shippingRates: { price: { centAmount: number } }[] }[])[0].shippingRates[0];
    rate.price.centAmount = 500;
    const { out } = await run(api);
    expect(out).toMatch(/FAIL\s+shipping zones.*malva-delivery-digital has a non-zero rate/);
  });

  it('defers the shipping methods until a product type defines offer-kind, then requires them', async () => {
    const api = new FakeCt();
    api.seed('zones', { key: 'usa', name: 'usa', locations: [{ country: 'US' }] });
    api.seed('zones', { key: 'europe', name: 'europe', locations: [{ country: 'DE' }] });
    await seedMain(['--confirm-project', 'spec-test-b2c-telecom', '--no-wait'], { api, source: SOURCE, manifest: buildManifest(), log: () => undefined });
    const early = await run(api);
    expect(early.out).toMatch(/PASS\s+shipping zones.*deferred until the product types define offer-kind/);
    expect(early.code).toBe(0);
    api.seed('product-types', { key: 'malva-offer', name: 'o', attributes: [{ name: 'offer-kind', savedToLineItem: true }] });
    const later = await run(api);
    expect(later.out).toMatch(/FAIL\s+shipping zones.*malva-shipping-standard missing/);
  });

  it('refuses an unknown project key', async () => {
    const api = new FakeCt();
    const lines: string[] = [];
    const code = await verify([], { api, source: { CTP_SEED_PROJECT_KEY: 'unknown' }, log: (l) => lines.push(l) });
    expect(code).toBe(2);
    expect(lines.join('\n')).toContain('"unknown"');
  });
});

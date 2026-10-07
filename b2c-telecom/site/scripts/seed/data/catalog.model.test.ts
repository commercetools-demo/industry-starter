import { describe, expect, it } from 'vitest';
import { buildManifest } from '../manifest';
import { main } from '../seed';
import { FakeCt } from '../test/fake-ct';
import { attr, masterAttr, nameEn, OFFERS, PRODUCTS, product, variantsOf } from './manifest-access';
import { SKU_PATTERN } from './catalog-validate';

const SOURCE = { CTP_SEED_PROJECT_KEY: 'spec-test-b2c-telecom' };

function baseline(): FakeCt {
  const api = new FakeCt();
  api.seed('zones', { key: 'usa', name: 'usa', locations: [{ country: 'US' }] });
  api.seed('zones', { key: 'europe', name: 'europe', locations: [{ country: 'DE' }, { country: 'GB' }] });
  return api;
}

async function run(api: FakeCt, argv: string[], manifest = buildManifest()) {
  const lines: string[] = [];
  const code = await main(argv, { api, source: SOURCE, manifest, log: (l) => lines.push(l), sleep: async () => undefined });
  return { code, out: lines.join('\n') };
}

describe('telecom-catalog-model scenarios', () => {
  it('Card is one product, selectors are variants: each plan offer is one product with one variant per term', () => {
    const cable500 = product('malva-offer-cable-500');
    expect(variantsOf(cable500).map((v) => attr(v, 'contract-term'))).toEqual(['24-months', 'month-to-month', '12-months']);
    expect(cable500.masterVariant.sku).toBe('MLV-CBL-500-24M');
    const unlimited = product('malva-offer-phone-unlimited');
    expect(variantsOf(unlimited).map((v) => attr(v, 'contract-term'))).toEqual(['month-to-month', '12-months', '24-months']);
    expect(variantsOf(product('malva-offer-wireless-5g')).map((v) => attr(v, 'contract-term'))).toEqual(['12-months', 'month-to-month']);
    // one card = one product: the term is not a second product
    expect(OFFERS.filter((o) => nameEn(o) === 'Cable 500')).toHaveLength(1);
  });

  it('Keys and SKUs are predictable: malva- keys, MLV- SKUs, no generated ids', () => {
    for (const p of PRODUCTS) {
      expect(p.key.startsWith('malva-')).toBe(true);
      for (const v of variantsOf(p)) {
        expect(v.sku).toMatch(SKU_PATTERN);
        expect(v.key).toBe(v.sku.toLowerCase());
        for (const price of v.prices) expect(price.key.startsWith(v.sku.toLowerCase())).toBe(true);
      }
    }
    for (const p of PRODUCTS.filter((x) => x.productType !== 'malva-offer')) expect(p.masterVariant.sku.endsWith('-BASE')).toBe(true);
    const manifest = buildManifest();
    const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
    expect(uuid.test(JSON.stringify(manifest))).toBe(false);
  });

  it('Design filters derive from attributes: chips computed from data-gb, network-generation and downstream-mbps each match a plan', () => {
    const chips: [string, (key: string) => boolean][] = [
      ['Up to 500 Mbps', (k) => (masterAttr(product(k), 'downstream-mbps') as number) <= 500],
      ['1 Gbps', (k) => (masterAttr(product(k), 'downstream-mbps') as number) > 500],
      ['Unlimited', (k) => masterAttr(product(k), 'data-gb') === -1],
      ['Data-capped', (k) => masterAttr(product(k), 'data-gb') !== -1],
      ['5G', (k) => masterAttr(product(k), 'network-generation') === '5g'],
      ['LTE', (k) => masterAttr(product(k), 'network-generation') === '4g'],
    ];
    const families: Record<string, string[]> = {
      'Up to 500 Mbps': ['malva-offer-cable-100', 'malva-offer-cable-500', 'malva-offer-cable-gig'],
      '1 Gbps': ['malva-offer-cable-100', 'malva-offer-cable-500', 'malva-offer-cable-gig'],
      Unlimited: ['malva-offer-phone-essential', 'malva-offer-phone-plus', 'malva-offer-phone-unlimited', 'malva-offer-phone-unlimited-max'],
      'Data-capped': ['malva-offer-phone-essential', 'malva-offer-phone-plus', 'malva-offer-phone-unlimited', 'malva-offer-phone-unlimited-max'],
      '5G': ['malva-offer-wireless-lite', 'malva-offer-wireless-5g', 'malva-offer-wireless-5g-plus'],
      LTE: ['malva-offer-wireless-lite', 'malva-offer-wireless-5g', 'malva-offer-wireless-5g-plus'],
    };
    for (const [label, matches] of chips) {
      expect(families[label].filter(matches).length, label).toBeGreaterThan(0);
    }
  });

  it('seed --plan against the fake prints only creates for the whole catalog', async () => {
    const api = baseline();
    const { code, out } = await run(api, ['--plan']);
    expect(code).toBe(0);
    expect(out).not.toMatch(/would update|would skip/);
    expect(out).toMatch(/PLAN create=\d+ update=0 unchanged=2 skip=0/);
    expect(out).toMatch(/would create\s+product malva-offer-cable-500/);
  });

  it('seeds the whole catalog on the fake, and a second run changes nothing', async () => {
    const api = baseline();
    const first = await run(api, ['--confirm-project', 'spec-test-b2c-telecom', '--no-wait']);
    expect(first.code).toBe(0);
    expect(api.list('product-types')).toHaveLength(6);
    expect(api.list('products')).toHaveLength(52);
    expect(api.list('categories')).toHaveLength(8);
    expect(api.list('inventory')).toHaveLength(19);
    expect(api.list('cart-discounts')).toHaveLength(6);
    expect(api.list('discount-codes')).toHaveLength(1);
    expect(api.list('types')).toHaveLength(6);
    expect(api.list('recurrence-policies')).toHaveLength(5);
    expect(api.list('custom-objects')).toHaveLength(11);
    expect(api.list('shipping-methods')).toHaveLength(2);
    api.log.length = 0;
    const second = await run(api, ['--confirm-project', 'spec-test-b2c-telecom', '--no-wait']);
    expect(second.code).toBe(0);
    expect(api.log).toEqual([]);
  });

  it('Editable in the Merchant Center: a changed router speed is a plain attribute update', async () => {
    const api = baseline();
    await run(api, ['--confirm-project', 'spec-test-b2c-telecom', '--no-wait']);
    const edited = buildManifest();
    const products = (edited.product ?? []).map((p) => structuredClone(p)) as typeof PRODUCTS;
    const router = products.find((p) => p.key === 'malva-router-ac1200');
    if (!router) throw new Error('router missing');
    router.masterVariant.attributes = router.masterVariant.attributes.map((a) => (a.name === 'max-downstream-mbps' ? { ...a, value: 400 } : a));
    edited.product = products;
    api.log.length = 0;
    const { out } = await run(api, ['--confirm-project', 'spec-test-b2c-telecom', '--no-wait'], edited);
    expect(api.log).toEqual(['update products malva-router-ac1200 setAttribute,publish']);
    expect(out).toMatch(/updated\s+product malva-router-ac1200/);
  });
});

import { describe, expect, it } from 'vitest';
import { runDeletion } from './deletion';
import { createFakeRoot } from './fake-root';
import { makeCtx } from './lib';
import { runSeed } from './seed';
import { formatChecks, runVerify } from './verify';
import { checkConfirm } from './reset-seed';

const ctxOf = (fake: ReturnType<typeof createFakeRoot>, dryRun = false) => ({ ...makeCtx(fake.root, { dryRun }, () => {}), pauseMs: 0 });

const sample = () => createFakeRoot({
  products: [{ id: 'p1', key: 'charcoal-chair', productType: { typeId: 'product-type', id: 'pt1' }, masterData: { published: true, staged: {} } }],
  productTypes: [{ id: 'pt1', key: 'furniture-and-decor' }],
  categories: [{ id: 'c1', key: 'home-decor', ancestors: [] }],
  shippingMethods: [{ id: 'sm1', key: 'standard-shipping', zoneRates: [], taxCategory: { typeId: 'tax-category', id: 'tx1' } }],
  taxCategories: [{ id: 'tx1', key: 'standard-tax' }],
  zones: [{ id: 'z1', key: 'usa' }, { id: 'z2', key: 'europe' }],
  stores: [{ id: 's1', key: 'b2c-retail-store' }],
  inventory: [{ id: 'i1', sku: 'charcoal-chair' }],
});

describe('seed.ts and verify.ts against a fake project', () => {
  it('cleanup, seed, verify green, second seed reports 0 changes (the E-10 sequence, offline)', async () => {
    const fake = sample();
    await runDeletion(ctxOf(fake), 'sample');
    const first = await runSeed(ctxOf(fake));
    expect(first.ok).toBe(true);
    expect(first.changed).toBeGreaterThan(50);
    const checks = await runVerify(fake.root);
    expect(formatChecks(checks.filter((c) => !c.ok))).toBe('');
    const writes = fake.log.length;
    const second = await runSeed(ctxOf(fake));
    expect(second).toMatchObject({ ok: true, changed: 0 });
    expect(fake.log.length).toBe(writes);
    expect(fake.store.products).toHaveLength(8 + 20);
    expect(fake.store.zones.map((z) => z.key).sort()).toEqual(['europe', 'mlv-same-day-states', 'usa']);
  });

  it('dry run seed creates nothing', async () => {
    const fake = createFakeRoot();
    const r = await runSeed(ctxOf(fake, true));
    expect(r.changed).toBeGreaterThan(0);
    expect(fake.log).toEqual([]);
  });

  it('verify fails on an unprefixed product, an unpublished product, a non-USD price, and a wrong fee', async () => {
    const fake = createFakeRoot();
    await runSeed(ctxOf(fake));
    fake.store.products.push({ id: 'x', key: 'charcoal-chair', masterData: { published: true, staged: { masterVariant: { prices: [{ value: { currencyCode: 'USD', centAmount: 1 } }] }, variants: [] } } });
    const doc = fake.store.products.find((p) => p.key === 'mlv-doc-amara-okafor') as { masterData: { published: boolean; staged: { masterVariant: { prices: { value: { currencyCode: string; centAmount: number } }[]} } } };
    doc.masterData.published = false;
    doc.masterData.staged.masterVariant.prices[0].value.centAmount = 3600;
    const med = fake.store.products.find((p) => p.key === 'mlv-med-ibuprofen-400-mg') as typeof doc;
    med.masterData.staged.masterVariant.prices[0].value.currencyCode = 'EUR';
    const failed = (await runVerify(fake.root)).filter((c) => !c.ok).map((c) => c.name);
    expect(failed).toEqual(expect.arrayContaining([
      'no unprefixed products', 'all products published', 'every variant has prices and all are USD',
      'doctor fees (cents) and modes match the price channels',
    ]));
  });

  it('verify fails on a wrong shipping rate, a missing inventory limit and an unindexed doctor', async () => {
    const fake = createFakeRoot();
    await runSeed(ctxOf(fake));
    const sameDay = fake.store.shippingMethods.find((m) => m.key === 'mlv-same-day') as { zoneRates: { shippingRates: { price: { centAmount: number } }[] }[] };
    sameDay.zoneRates[0].shippingRates[0].price.centAmount = 50000;
    delete fake.store.inventory[0].maxCartQuantity;
    fake.store.products = fake.store.products.filter((p) => p.key !== 'mlv-doc-amara-okafor');
    const failed = (await runVerify(fake.root)).filter((c) => !c.ok).map((c) => c.name);
    expect(failed).toEqual(expect.arrayContaining([
      'mlv-same-day costs 500 cents', 'inventory entry per medication SKU (stock >= 500, cart limit = maxQtyPerOrder)', '8 doctor products', 'Product Search finds "Okafor"',
    ]));
  });

  it('reset deletes everything the seed created and nothing else, and the seed can be rebuilt', async () => {
    const fake = createFakeRoot({ zones: [{ id: 'z1', key: 'usa', version: 1 }, { id: 'z2', key: 'europe', version: 1 }], products: [{ id: 'keep', key: 'charcoal-chair', version: 1, masterData: { published: true, staged: {} } }] });
    await runSeed(ctxOf(fake));
    const { planned, deleted } = await runDeletion(ctxOf(fake), 'seed');
    expect(planned).toBe(deleted);
    for (const [kind, list] of Object.entries(fake.store)) {
      expect(list.filter((r) => String(r.key ?? '').startsWith('mlv-')), kind).toEqual([]);
    }
    expect(fake.store.products.map((p) => p.key)).toEqual(['charcoal-chair']);
    expect(fake.store.zones.map((z) => z.key)).toEqual(['usa', 'europe']);
    expect((await runSeed(ctxOf(fake))).ok).toBe(true);
  });

  it('verify fails when clinicName is not searchable in the project (D-039)', async () => {
    const fake = createFakeRoot();
    await runSeed(ctxOf(fake));
    const doctorType = fake.store.productTypes.find((t) => t.key === 'mlv-doctor') as { attributes: { name: string; isSearchable: boolean }[] };
    doctorType.attributes.find((a) => a.name === 'clinicName')!.isSearchable = false;
    const failed = (await runVerify(fake.root)).filter((c) => !c.ok);
    expect(failed.map((c) => c.name)).toEqual(['every attribute the storefront searches is isSearchable (incl. clinicName)']);
    expect(failed[0].detail).toContain('mlv-doctor.clinicName');
    // the seed repairs it with changeIsSearchable, in place
    expect((await runSeed(ctxOf(fake))).ok).toBe(true);
    expect(fake.log.some((l) => l.kind === 'productTypes' && l.actions?.includes('changeIsSearchable'))).toBe(true);
    expect((await runVerify(fake.root)).filter((c) => !c.ok)).toEqual([]);
  });

  it('reset needs --confirm', () => {
    expect(() => checkConfirm({ dryRun: false })).toThrow();
    expect(() => checkConfirm({ dryRun: false, confirm: 'spec-test-b2c-healthcare' })).not.toThrow();
  });
});

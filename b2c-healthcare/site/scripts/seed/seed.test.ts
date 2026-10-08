import { describe, expect, it } from 'vitest';
import { runDeletion } from './deletion';
import { DOCTORS, doctorKey } from './data/doctors';
import type { ImageEntry } from './data/images';
import { MEDICATIONS, medKey } from './data/medications';
import { createFakeRoot } from './fake-root';
import { makeCtx } from './lib';
import { runSeed } from './seed';
import { formatChecks, runVerify } from './verify';
import { checkConfirm } from './reset-seed';

const img = (key: string): ImageEntry[] => [{ url: `https://images.example/${key}.jpg`, dimensions: { w: 800, h: 600 } }];
const allImages = Object.fromEntries([...DOCTORS.map(doctorKey), ...MEDICATIONS.map(medKey)].map((k) => [k, img(k)]));
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
    const first = await runSeed(ctxOf(fake), { images: allImages });
    expect(first.ok).toBe(true);
    expect(first.changed).toBeGreaterThan(50);
    const checks = await runVerify(fake.root);
    expect(formatChecks(checks.filter((c) => !c.ok))).toBe('');
    const writes = fake.log.length;
    const second = await runSeed(ctxOf(fake), { images: allImages });
    expect(second).toMatchObject({ ok: true, changed: 0 });
    expect(fake.log.length).toBe(writes);
    expect(fake.store.products).toHaveLength(8 + 20);
    expect(fake.store.zones.map((z) => z.key).sort()).toEqual(['europe', 'mlv-same-day-states', 'usa']);
  });

  it('dry run seed creates nothing', async () => {
    const fake = createFakeRoot();
    const r = await runSeed(ctxOf(fake, true), { images: allImages });
    expect(r.changed).toBeGreaterThan(0);
    expect(fake.log).toEqual([]);
  });

  it('seed without stored images still creates products; verify then flags the missing images only', async () => {
    const fake = createFakeRoot();
    await runSeed(ctxOf(fake));
    const checks = await runVerify(fake.root);
    expect(checks.filter((c) => !c.ok).map((c) => c.name)).toEqual(['every product has images and every image URL is clean (no ? or #)']);
    expect((await runVerify(fake.root, { images: false })).every((c) => c.ok)).toBe(true);
  });

  it('verify fails on an unprefixed product, an unpublished product, a non-USD price, a dirty image URL and a wrong fee', async () => {
    const fake = createFakeRoot();
    await runSeed(ctxOf(fake), { images: allImages });
    fake.store.products.push({ id: 'x', key: 'charcoal-chair', masterData: { published: true, staged: { masterVariant: { prices: [{ value: { currencyCode: 'USD', centAmount: 1 } }], images: [{ url: 'https://h/a.jpg' }] }, variants: [] } } });
    const doc = fake.store.products.find((p) => p.key === 'mlv-doc-amara-okafor') as { masterData: { published: boolean; staged: { masterVariant: { prices: { value: { currencyCode: string; centAmount: number } }[]; images: { url: string }[] } } } };
    doc.masterData.published = false;
    doc.masterData.staged.masterVariant.prices[0].value.centAmount = 3600;
    const med = fake.store.products.find((p) => p.key === 'mlv-med-ibuprofen-400-mg') as typeof doc;
    med.masterData.staged.masterVariant.prices[0].value.currencyCode = 'EUR';
    med.masterData.staged.masterVariant.images = [{ url: 'https://h/a.jpg?w=1' }];
    const failed = (await runVerify(fake.root)).filter((c) => !c.ok).map((c) => c.name);
    expect(failed).toEqual(expect.arrayContaining([
      'no unprefixed products', 'all products published', 'every variant has prices and all are USD',
      'every product has images and every image URL is clean (no ? or #)', 'doctor fees (cents) and modes match the price channels',
    ]));
  });

  it('verify fails on a wrong shipping rate, a missing inventory limit and an unindexed doctor', async () => {
    const fake = createFakeRoot();
    await runSeed(ctxOf(fake), { images: allImages });
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
    await runSeed(ctxOf(fake), { images: allImages });
    const { planned, deleted } = await runDeletion(ctxOf(fake), 'seed');
    expect(planned).toBe(deleted);
    for (const [kind, list] of Object.entries(fake.store)) {
      expect(list.filter((r) => String(r.key ?? '').startsWith('mlv-')), kind).toEqual([]);
    }
    expect(fake.store.products.map((p) => p.key)).toEqual(['charcoal-chair']);
    expect(fake.store.zones.map((z) => z.key)).toEqual(['usa', 'europe']);
    expect((await runSeed(ctxOf(fake), { images: allImages })).ok).toBe(true);
  });

  it('reset needs --confirm', () => {
    expect(() => checkConfirm({ dryRun: false })).toThrow();
    expect(() => checkConfirm({ dryRun: false, confirm: 'spec-test-b2c-healthcare' })).not.toThrow();
  });
});

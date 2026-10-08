import { describe, expect, it } from 'vitest';
import { checkConfirm } from './cleanup-sample';
import { runDeletion, SAMPLE_ORDER, SEED_ORDER } from './deletion';
import { createFakeRoot } from './fake-root';
import { makeCtx } from './lib';

const published = () => ({ published: true, staged: {} });

function sampleProject() {
  return createFakeRoot({
    carts: [{ id: 'cart-1' }],
    orders: [{ id: 'order-1' }],
    inventory: [{ id: 'inv-1', sku: 'chair' }, { id: 'inv-mlv', key: 'mlv-inv-MED-x', sku: 'MED-x' }],
    products: [
      { id: 'p-chair', key: 'charcoal-chair', productType: { typeId: 'product-type', id: 'pt-furniture' }, masterData: published() },
      { id: 'p-mlv', key: 'mlv-med-x', productType: { typeId: 'product-type', key: 'mlv-medication' }, masterData: published() },
    ],
    categories: [
      { id: 'c-root', key: 'home-decor', ancestors: [] },
      { id: 'c-kid', key: 'furniture', ancestors: [{ typeId: 'category', id: 'c-root' }] },
      { id: 'c-grandkid', key: 'chairs', ancestors: [{ typeId: 'category', id: 'c-root' }, { typeId: 'category', id: 'c-kid' }] },
      { id: 'c-mlv', key: 'mlv-medicines', ancestors: [] },
    ],
    productTypes: [{ id: 'pt-furniture', key: 'furniture-and-decor' }, { id: 'pt-mlv', key: 'mlv-medication' }],
    shippingMethods: [
      { id: 'sm-old', key: 'standard-shipping', zoneRates: [{ zone: { typeId: 'zone', id: 'z-usa' }, shippingRates: [] }], taxCategory: { typeId: 'tax-category', id: 'tax-old' } },
      { id: 'sm-mlv', key: 'mlv-standard', zoneRates: [{ zone: { typeId: 'zone', key: 'mlv-same-day-states' }, shippingRates: [] }], taxCategory: { typeId: 'tax-category', key: 'mlv-rx-medicine' } },
    ],
    taxCategories: [{ id: 'tax-old', key: 'standard-tax' }, { id: 'tax-mlv', key: 'mlv-rx-medicine' }],
    stores: [{ id: 's-1', key: 'b2c-retail-store' }],
    zones: [{ id: 'z-usa', key: 'usa' }, { id: 'z-eu', key: 'europe' }, { id: 'z-old', key: 'old-zone' }, { id: 'z-mlv', key: 'mlv-same-day-states' }],
    customers: [{ id: 'cust-1', key: 'someone' }],
  });
}

const run = (fake: ReturnType<typeof createFakeRoot>, mode: 'sample' | 'seed', dryRun = false) =>
  runDeletion({ ...makeCtx(fake.root, { dryRun }, () => {}), pauseMs: 0 }, mode);

describe('cleanup-sample', () => {
  it('deletes every non-mlv resource in dependency order and never touches mlv- resources', async () => {
    const fake = sampleProject();
    const { deleted } = await run(fake, 'sample');
    const del = fake.log.filter((l) => l.op === 'delete');
    expect(deleted).toBe(del.length);
    expect(del.map((l) => l.kind)).toEqual([
      'carts', 'orders', 'inventory', 'products', 'categories', 'categories', 'categories',
      'productTypes', 'shippingMethods', 'taxCategories', 'stores', 'zones',
    ]);
    expect(del.map((l) => l.id)).toEqual(['cart-1', 'order-1', 'inv-1', 'p-chair', 'c-grandkid', 'c-kid', 'c-root', 'pt-furniture', 'sm-old', 'tax-old', 's-1', 'z-old']);
    expect(del.some((l) => (l.key ?? '').startsWith('mlv-'))).toBe(false);
    expect(fake.store.products.map((p) => p.key)).toEqual(['mlv-med-x']);
    expect(fake.store.zones.map((z) => z.key)).toEqual(['usa', 'europe', 'mlv-same-day-states']);
    expect(fake.store.customers).toHaveLength(1);
  });

  it('unpublishes a published product before deleting it', async () => {
    const fake = sampleProject();
    await run(fake, 'sample');
    const chair = fake.log.filter((l) => l.id === 'p-chair').map((l) => `${l.op}${l.actions ? `:${l.actions.join(',')}` : ''}`);
    expect(chair).toEqual(['update:unpublish', 'delete']);
  });

  it('is idempotent: a second run finds nothing to delete', async () => {
    const fake = sampleProject();
    await run(fake, 'sample');
    expect(await run(fake, 'sample')).toEqual({ planned: 0, deleted: 0 });
  });

  it('dry run lists and deletes nothing', async () => {
    const fake = sampleProject();
    const lines: string[] = [];
    const ctx = { ...makeCtx(fake.root, { dryRun: true }, (l) => lines.push(l)), pauseMs: 0 };
    const { planned, deleted } = await runDeletion(ctx, 'sample');
    expect(planned).toBe(12);
    expect(deleted).toBe(0);
    expect(fake.log).toEqual([]);
    expect(lines[0]).toBe('would delete  carts cart-1');
  });

  it('a real run needs --confirm with the project key', () => {
    expect(() => checkConfirm({ dryRun: false })).toThrow(/--confirm spec-test-b2c-healthcare/);
    expect(() => checkConfirm({ dryRun: false, confirm: 'other' })).toThrow();
    expect(() => checkConfirm({ dryRun: false, confirm: 'spec-test-b2c-healthcare' })).not.toThrow();
    expect(() => checkConfirm({ dryRun: true })).not.toThrow();
  });

  it('the orders in the plan match E-03', () => {
    expect(SAMPLE_ORDER.slice(0, 4)).toEqual(['carts', 'orders', 'inventory', 'products']);
    expect(SEED_ORDER).not.toContain('carts');
  });
});

describe('reset (seed mode)', () => {
  it('deletes only mlv- resources and leaves the sample data alone', async () => {
    const fake = sampleProject();
    fake.store.states = [
      { id: 'st-a', version: 1, key: 'mlv-received', transitions: [{ typeId: 'state', key: 'mlv-delivered' }] },
      { id: 'st-b', version: 1, key: 'mlv-delivered', transitions: [] },
      { id: 'st-other', version: 1, key: 'Initial' },
    ];
    await run(fake, 'seed');
    const del = fake.log.filter((l) => l.op === 'delete');
    expect(del.every((l) => (l.key ?? '').startsWith('mlv-'))).toBe(true);
    expect(fake.store.products.map((p) => p.key)).toEqual(['charcoal-chair']);
    expect(fake.store.states.map((s) => s.key)).toEqual(['Initial']);
    expect(fake.store.carts).toHaveLength(1);
    expect(fake.store.zones.map((z) => z.key)).toEqual(['usa', 'europe', 'old-zone']);
  });
});

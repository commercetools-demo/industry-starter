// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { SAMPLE_ALLOWLIST } from './data/sample-allowlist';
import { DELETE_ORDER, executeCleanup, formatCounts, planCleanup } from './cleanup';
import { FakeApi } from './fake-api';
import { Runner } from './lib';
import { isResettable, planReset, resetTargets } from './reset';
import { runSeed } from './seed';

const quiet = () => undefined;

/** A small copy of the real sample data: categories (3 deep), product type, tax, zone, shipping, channel, product, standalone price, discounts. */
function sampleProject(): FakeApi {
  const api = new FakeApi();
  const tax = api.put('tax-categories', { key: 'standard-tax' });
  const zone = api.put('zones', { key: 'europe' });
  api.put('shipping-methods', { key: 'standard-shipping-method', taxCategory: { typeId: 'tax-category', id: tax.id }, zoneRates: [{ zone: { typeId: 'zone', id: zone.id } }] });
  const pt = api.put('product-types', { key: 'generic-product' });
  const root = api.put('categories', { key: 'spare-parts', ancestors: [] });
  const mid = api.put('categories', { key: 'excavators', ancestors: [{ typeId: 'category', id: root.id }], parent: { typeId: 'category', id: root.id } });
  api.put('categories', { key: 'amphibious-excavators', ancestors: [{ typeId: 'category', id: root.id }, { typeId: 'category', id: mid.id }], parent: { typeId: 'category', id: mid.id } });
  const ch = api.put('channels', { key: 'default-channel' });
  api.put('products', { key: 'air-filter', productType: { typeId: 'product-type', id: pt.id }, masterData: { published: true, current: {}, staged: {} } });
  api.put('standalone-prices', { key: 'air-filter-1', sku: 'air-filter', channel: { typeId: 'channel', id: ch.id } });
  api.put('product-discounts', { key: 'spare-parts-5-eur-off' });
  api.put('cart-discounts', { key: 'tower-cranes-bogo' });
  api.put('recurrence-policies', { key: 'policy-monthly' });
  // things that are NOT in the allow-list and must survive
  const ownType = api.put('product-types', { key: 'customer-own-type' });
  api.put('products', { key: 'customer-own-product', productType: { typeId: 'product-type', id: ownType.id }, masterData: { published: true, current: {}, staged: {} } });
  api.put('categories', { key: 'customer-own-category', ancestors: [] });
  api.put('associate-roles', { key: 'approver' });
  api.put('standalone-prices', { key: 'other-1', sku: 'some-other-sku' });
  return api;
}

describe('seed:cleanup (explicit allow-list, no wildcard)', () => {
  it('plans only allow-listed sample resources and counts what it leaves', async () => {
    const api = sampleProject();
    const plan = await planCleanup(api);
    const labels = plan.entries.map((e) => e.label);
    expect(labels).toContain('products air-filter');
    expect(labels).toContain('standalone-prices air-filter-1');
    expect(labels).not.toContain('products customer-own-product');
    expect(labels).not.toContain('categories customer-own-category');
    expect(labels).not.toContain('standalone-prices other-1');
    expect(plan.counts.find((c) => c.kind === 'products')).toEqual({ kind: 'products', listed: 2, matched: 1, left: 1 });
    expect(plan.counts.find((c) => c.kind === 'categories')).toMatchObject({ listed: 4, matched: 3, left: 1 });
    expect(formatCounts(plan)[0]).toContain('listed');
    expect(formatCounts(plan).join('\n')).toMatch(/products\s+2\s+1\s+1/);
  });

  it('deletes in an order the platform accepts (references, children before parents, unpublish first)', async () => {
    const api = sampleProject();
    const plan = await planCleanup(api);
    const run = new Runner(false, quiet);
    const failed = await executeCleanup(api, run, plan);
    expect(failed).toBe(0);
    expect(run.changes).toBe(plan.entries.length);
    const left = (k: Parameters<FakeApi['all']>[0]) => api.all(k).map((r) => r.key);
    expect(left('products')).toEqual(['customer-own-product']);
    expect(left('categories')).toEqual(['customer-own-category']);
    expect(left('associate-roles')).toEqual(['approver']);
    expect(left('standalone-prices')).toEqual(['other-1']);
    expect(left('channels')).toEqual([]);
    expect(left('shipping-methods')).toEqual([]);
    expect(left('tax-categories')).toEqual([]);
    expect(left('zones')).toEqual([]);
  });

  it('a dry run deletes nothing', async () => {
    const api = sampleProject();
    const plan = await planCleanup(api);
    const run = new Runner(true, quiet);
    await executeCleanup(api, run, plan);
    expect(run.lines.every((l) => l.startsWith('would delete'))).toBe(true);
    expect(api.writes).toBe(0);
    expect(api.all('products')).toHaveLength(2);
  });

  it('refuses a resource with the seed prefix even if it is on the list', async () => {
    const api = new FakeApi();
    api.put('categories', { key: 'mau-cat-brakes', ancestors: [] });
    api.put('products', { key: 'mau-part-x', masterData: { published: false, current: {}, staged: {} } });
    const plan = await planCleanup(api, { ...SAMPLE_ALLOWLIST, categories: ['mau-cat-brakes'], products: ['mau-part-x'] });
    expect(plan.entries).toEqual([]);
    expect(plan.refused).toHaveLength(2);
    expect(plan.refused[0]).toMatch(/seed prefix/);
  });

  it('allow-list is explicit: no empty or wildcard entries, and it names the three known sample product types and two shipping methods', () => {
    const all = Object.values(SAMPLE_ALLOWLIST).flat() as string[];
    expect(all.every((k) => k.length > 1 && !/[*%?]/.test(k) && !k.startsWith('mau-'))).toBe(true);
    expect(SAMPLE_ALLOWLIST['product-types']).toEqual(['generic-product', 'heavy-earthmoving-and-construction-equipment', 'heavy-lifting-and-specialized-equipment']);
    expect(SAMPLE_ALLOWLIST['shipping-methods']).toEqual(['standard-shipping-method', 'premium-shipping-method']);
    expect(SAMPLE_ALLOWLIST.products).toHaveLength(72);
    expect(SAMPLE_ALLOWLIST.categories).toHaveLength(42);
    expect(DELETE_ORDER[0]).toBe('standalone-prices');
  });

  it('allow-list counts match the sample project read through the MCP (2026-10-12), keys are unique, and every listed kind is deleted', () => {
    const n = (k: keyof typeof SAMPLE_ALLOWLIST) => SAMPLE_ALLOWLIST[k].length;
    expect([n('products'), n('categories'), n('product-types'), n('shipping-methods'), n('tax-categories'), n('zones'), n('channels')]).toEqual([72, 42, 3, 2, 1, 2, 8]);
    expect(n('product-discounts') + n('cart-discounts')).toBe(4);
    expect([n('recurrence-policies'), n('standalone-price-skus')]).toEqual([4, 7]);
    for (const [kind, keys] of Object.entries(SAMPLE_ALLOWLIST)) expect(new Set(keys).size, kind).toBe(keys.length);
    expect(SAMPLE_ALLOWLIST.channels).toEqual(expect.arrayContaining(['eu-warehouse', 'spain', 'us-warehouse', 'us-large-customers', 'default-channel', 'us-medium-customers', 'de-fr-uk', 'default-warehouse']));
    // associate roles and anything else of the sample is deliberately not deletable
    expect(Object.keys(SAMPLE_ALLOWLIST)).not.toContain('associate-roles');
    for (const kind of DELETE_ORDER) expect(Object.keys(SAMPLE_ALLOWLIST).some((k) => k === kind || k === 'standalone-price-skus')).toBe(true);
  });

  it('cleanup then seed works on a project that has sample data (no slug or key clash)', async () => {
    const api = sampleProject();
    await executeCleanup(api, new Runner(false, quiet), await planCleanup(api));
    await expect(runSeed({ api, run: new Runner(false, quiet), demoPassword: 'dummy-long-demo-password' })).resolves.toBeGreaterThan(300);
    expect(api.all('products').some((p) => p.key === 'customer-own-product')).toBe(true);
  });
});

describe('reset (the seed own resources only)', () => {
  it('removes everything the seed created, in a valid order, and the seed can rebuild it', async () => {
    const api = sampleProject();
    const opts = { api, run: new Runner(false, quiet), demoPassword: 'dummy-long-demo-password' };
    await runSeed(opts);
    await api.putObject('configuration', 'default-theme', { colorPrimary: '#821810' });
    const plan = await planReset(api);
    expect(plan.refused).toEqual([]);
    expect(plan.entries.length).toBeGreaterThan(300);
    expect(plan.objects.some((o) => o.container === 'malva-local-review')).toBe(true);
    const failed = await executeCleanup(api, new Runner(false, quiet), plan);
    expect(failed).toBe(0);
    expect(api.all('reviews')).toEqual([]);
    for (const o of plan.objects) await api.removeObject(o.container, o.key);
    for (const kind of ['products', 'categories', 'stores', 'customers', 'business-units', 'channels', 'inventory'] as const) {
      expect(api.all(kind).filter((r) => r.key?.startsWith('mau-'))).toEqual([]);
    }
    for (const kind of ['types', 'states'] as const) expect(api.all(kind)).toEqual([]);
    expect(api.all('standalone-prices').map((p) => p.key).sort()).toEqual(['air-filter-1', 'other-1']); // sample prices are not the seed's: reset leaves them
    // sample data and the Contentools theme were not touched
    expect(api.all('products').map((p) => p.key)).toContain('air-filter');
    expect(await api.getObject('configuration', 'default-theme')).toBeDefined();
    expect(await runSeed({ ...opts, run: new Runner(false, quiet) })).toBeGreaterThan(300);
  });

  it('lists only seed keys (mau- prefix, the contract type and state keys, and the seed standalone price scheme)', () => {
    for (const t of resetTargets()) expect(t.keys.every((k) => isResettable(t.kind, k))).toBe(true);
    expect(resetTargets()[0]?.kind).toBe('reviews'); // reviews reference products
    expect(resetTargets()[1]?.kind).toBe('standalone-prices'); // prices reference channels, so they go first
    expect(isResettable('types', 'store-settings')).toBe(true);
    expect(isResettable('types', 'some-customer-type')).toBe(false);
    expect(isResettable('standalone-prices', 'air-filter-1')).toBe(false);
  });
});

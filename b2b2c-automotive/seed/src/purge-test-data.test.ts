// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import type { Kind } from './api';
import { executeCleanup } from './cleanup';
import { FakeApi } from './fake-api';
import { Runner } from './lib';
import { carriesTestMarker, executePurge, formatPlan, parseRegister, planPurge, PURGE_ORDER } from './purge-test-data';
import { planReset } from './reset';
import { runSeed } from './seed';

const quiet = () => undefined;

function project() {
  const api = new FakeApi();
  const cart = api.put('carts', { key: 'TST-cart-1' });
  const order = api.put('orders', { orderNumber: 'TST-V-1001' });
  const real = api.put('orders', { orderNumber: '10001' });
  const seeded = api.put('customers', { key: 'mau-cu-north-admin', email: 'tst-x@example.com' });
  const customer = api.put('customers', { email: 'tst-anna@example.com' });
  const review = api.put('reviews', { title: 'TST-review' });
  const unregistered = api.put('carts', { key: 'TST-not-in-register' });
  return { api, cart, order, real, seeded, customer, review, unregistered };
}

const register = (rows: [string, string][]) => ['# test data', '', '| Type | Id | Note |', '| --- | --- | --- |', ...rows.map(([k, id]) => `| ${k} | ${id} | note |`)].join('\n');

describe('purge test data', () => {
  it('purge script is dry run by default', async () => {
    const t = project();
    const { records } = parseRegister(register([['carts', t.cart.id], ['orders', t.order.id]]), 'V/test-data.md');
    const plan = await planPurge(t.api, records);
    expect(plan.entries).toHaveLength(2);
    expect(formatPlan(plan, true)[0]).toContain('DRY RUN');
    const writes = t.api.writes;
    const failed = await executePurge(t.api, new Runner(true, quiet), plan); // dry run: the Runner never calls the delete
    expect(failed).toBe(0);
    expect(t.api.writes).toBe(writes);
    expect(t.api.all('carts')).toHaveLength(2);
    expect(t.api.all('orders')).toHaveLength(2);
  });

  it('purge deletes registered TST- records in dependency order when applied', async () => {
    const t = project();
    const { records } = parseRegister(register([['carts', t.cart.id], ['customers', t.customer.id], ['reviews', t.review.id], ['orders', t.order.id]]), 'V/test-data.md');
    const plan = await planPurge(t.api, records);
    expect(plan.entries.map((e) => e.kind)).toEqual(['reviews', 'orders', 'carts', 'customers']);
    expect(await executePurge(t.api, new Runner(false, quiet), plan)).toBe(0);
    expect(t.api.all('carts').map((c) => c.id)).toEqual([t.unregistered.id]);
    expect(t.api.all('orders').map((o) => o.id)).toEqual([t.real.id]);
    expect(t.api.all('reviews')).toEqual([]);
  });

  it('a record without the TST- prefix is skipped even if listed, and so is seed data', async () => {
    const t = project();
    const { records } = parseRegister(register([['orders', t.real.id], ['customers', t.seeded.id]]), 'V/test-data.md');
    const plan = await planPurge(t.api, records);
    expect(plan.entries).toEqual([]);
    expect(plan.skipped.join('\n')).toMatch(/no TST- marker/);
    expect(plan.skipped.join('\n')).toMatch(/seed prefix/);
    await executePurge(t.api, new Runner(false, quiet), plan);
    expect(t.api.all('orders')).toHaveLength(2);
    expect(t.api.all('customers')).toHaveLength(2);
  });

  it('purge respects registers: ids not in the registers are never touched', async () => {
    const t = project();
    const plan = await planPurge(t.api, parseRegister(register([['carts', t.cart.id]]), 'V/test-data.md').records);
    await executePurge(t.api, new Runner(false, quiet), plan);
    expect(t.api.all('carts').map((c) => c.id)).toEqual([t.unregistered.id]); // TST- prefix alone is not enough
    expect(t.api.all('orders')).toHaveLength(2);
  });

  it('reads only well-formed rows and lists kinds it cannot delete as manual', () => {
    const parsed = parseRegister(['| Type | Id |', '| --- | --- |', '| carts | abc-12345 |', '| recurring-orders | ro-123456 |', '| widgets | ww-123456 |', '| carts | x |', 'prose | carts | zzzzzz'].join('\n'), 's');
    expect(parsed.records).toEqual([{ kind: 'carts', id: 'abc-12345', source: 's' }]);
    expect(parsed.manual).toEqual([{ kind: 'recurring-orders', id: 'ro-123456', source: 's' }]);
  });

  it('marker check looks at key, number, code, name and test e-mails only', () => {
    expect(carriesTestMarker({ id: '1', version: 1, name: { 'de-DE': 'TST-Name' } })).toBe(true);
    expect(carriesTestMarker({ id: '1', version: 1, email: 'tst-a@example.com' })).toBe(true);
    expect(carriesTestMarker({ id: '1', version: 1, email: 'tst-a@real.com' })).toBe(false);
    expect(carriesTestMarker({ id: '1', version: 1, key: 'tst-lower' })).toBe(false);
    expect(carriesTestMarker({ id: '1', version: 1, note: 'TST-only-in-note' })).toBe(false);
  });
});

describe('seed data sweep (reset covers everything the seed creates)', () => {
  it('after seed and reset the project holds exactly what it held before, in every kind and container the seed writes', async () => {
    const api = new FakeApi();
    api.put('product-types', { key: 'generic-product' });
    api.put('standalone-prices', { key: 'air-filter-1', sku: 'air-filter' });
    api.put('associate-roles', { key: 'approver' });
    await api.putObject('configuration', 'default-theme', { colorPrimary: '#821810' });
    const kinds = ['product-types', 'categories', 'products', 'tax-categories', 'zones', 'shipping-methods', 'channels', 'customer-groups', 'types', 'stores', 'product-selections', 'associate-roles', 'business-units', 'customers', 'inventory', 'product-discounts', 'cart-discounts', 'discount-codes', 'recurrence-policies', 'product-tailoring', 'standalone-prices', 'states', 'carts', 'orders', 'reviews'] as Kind[];
    const before = new Map(kinds.map((k) => [k, api.all(k).map((r) => r.id).sort()]));
    const objectsBefore = (await api.listObjects('configuration')).map((o) => o.key);

    expect(await runSeed({ api, run: new Runner(false, quiet), demoPassword: 'a-long-demo-password' })).toBeGreaterThan(300);
    const created = kinds.filter((k) => api.all(k).length > (before.get(k)?.length ?? 0));
    expect(created.length).toBeGreaterThan(10); // the seed really wrote many kinds

    const plan = await planReset(api);
    expect(plan.refused).toEqual([]);
    expect(await executeCleanup(api, new Runner(false, quiet), plan)).toBe(0);
    for (const o of plan.objects) await api.removeObject(o.container, o.key);

    for (const k of kinds) expect(api.all(k).map((r) => r.id).sort(), `kind ${k} has leftovers`).toEqual(before.get(k));
    expect((await api.listObjects('configuration')).map((o) => o.key)).toEqual(objectsBefore); // the Contentools default theme stays
    expect(PURGE_ORDER).not.toContain('products'); // the purge script never deletes catalogue data
  });
});

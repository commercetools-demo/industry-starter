// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import type { Res } from './api';
import { PRODUCTS } from './data/products';
import { FakeApi } from './fake-api';
import { Runner } from './lib';
import { STEP_NAMES, runSeed, selectSteps } from './seed';
import { verifySeed } from './verify';

const quiet = () => undefined;
const opts = (api: FakeApi, dryRun = false) => ({ api, run: new Runner(dryRun, quiet), demoPassword: 'dummy-long-demo-password' });

describe('Idempotent seed in dependency order', () => {
  it('creates everything in dependency order (no unresolved reference) and verify finds no problem', async () => {
    const api = new FakeApi();
    const r = await runSeed(opts(api));
    expect(r.skipped).toEqual([]);
    expect(r.changes).toBeGreaterThan(1000);
    expect(await verifySeed(api)).toEqual([]);
    expect(api.project.searchIndexing?.productsSearch?.status).toBe('Activated');
  });

  it('runs the steps in the documented order', () => {
    expect(STEP_NAMES).toEqual(['settings', 'tax', 'shipping', 'states', 'types', 'product-types', 'categories', 'channels', 'recurrence', 'products', 'prices', 'inventory', 'discounts', 'customers', 'shopping-lists', 'review-states', 'reviews']);
  });

  it('Re-run', async () => {
    const api = new FakeApi();
    await runSeed(opts(api));
    const writes = api.writes;
    const second = new Runner(false, quiet);
    const r = await runSeed({ ...opts(api), run: second });
    expect(r.changes).toBe(0); // reported as "0 change(s)"
    expect(second.lines).toEqual([]);
    expect(api.writes).toBe(writes);
  });

  it('Partial run', async () => {
    // Nothing exists: prices needs products and recurrence policies, which are not part of the run, so it is reported, not created.
    const api = new FakeApi();
    const run = new Runner(false, quiet);
    const r = await runSeed({ ...opts(api), run }, 'products,prices');
    expect(r.skipped.length).toBe(2);
    expect(r.skipped[0]).toMatch(/products: SKIPPED, missing prerequisite .*product-types mcf-pods/);
    expect(r.skipped[1]).toMatch(/prices: SKIPPED, missing prerequisite .*recurrence-policies mcf-every-month/);
    expect(selectSteps('products,prices').map((s) => s.name)).toEqual(['products', 'prices']);
    expect(r.perStep.map((s) => s.step)).toEqual([]);
    expect(api.all('products')).toHaveLength(0);

    // With the prerequisites in the project, only the selected steps run.
    const full = new FakeApi();
    await runSeed(opts(full), 'settings,tax,product-types,categories,recurrence');
    const lines = new Runner(false, quiet);
    const ok = await runSeed({ ...opts(full), run: lines }, 'products,prices');
    expect(ok.skipped).toEqual([]);
    expect(ok.perStep.map((s) => s.step)).toEqual(['products', 'prices']);
    expect(full.all('products')).toHaveLength(PRODUCTS.length);
    expect(full.all('inventory')).toHaveLength(0);
    expect(full.all('customers')).toHaveLength(0);
    expect(lines.lines.every((l) => /product/.test(l))).toBe(true);
  });

  it('rejects an unknown step name', () => {
    expect(() => selectSteps('products,nope')).toThrow(/Unknown step nope/);
  });

  it('a dry run on an empty project plans changes but writes nothing', async () => {
    const api = new FakeApi();
    const run = new Runner(true, quiet);
    const r = await runSeed({ ...opts(api), run });
    expect(r.changes).toBeGreaterThan(0);
    expect(run.lines.every((l) => l.startsWith('would '))).toBe(true);
    expect(api.writes).toBe(0);
  });

  it('every demo account is email-verified, including accounts that already existed unverified', async () => {
    const api = new FakeApi();
    api.put('customers', { key: 'mcf-customer-maya', email: 'maya.okonkwo@example.com', isEmailVerified: false });
    await runSeed(opts(api));
    expect(api.all('customers').filter((c) => c.isEmailVerified !== true).map((c) => c.key)).toEqual([]);
  });

  it('refuses a short demo password before creating customers', async () => {
    await expect(runSeed({ ...opts(new FakeApi()), demoPassword: 'short' }, 'customers')).rejects.toThrow(/at least 10 characters/);
  });

  it('never sends the demo password to be stored (the fake drops it) and never logs it', async () => {
    const api = new FakeApi();
    const logs: string[] = [];
    await runSeed({ api, run: new Runner(false, (l) => logs.push(l)), demoPassword: 'secret-demo-password-1' });
    expect(logs.join('\n')).not.toContain('secret-demo-password-1');
    expect(JSON.stringify(api.all('customers'))).not.toContain('secret-demo-password-1');
  });

  it('repairs drift: a changed price, a changed channel field, a changed inventory quantity and a changed tax rate come back', async () => {
    const api = new FakeApi();
    await runSeed(opts(api));
    const product = (await api.getByKey('products', PRODUCTS[0]?.key as string)) as Res;
    const staged = (product.masterData as { staged: { masterVariant: { sku: string; prices: { value: { centAmount: number } }[] } } }).staged;
    await api.update('products', product, [{ action: 'setPrices', sku: staged.masterVariant.sku, prices: [{ value: { currencyCode: 'USD', centAmount: 1 }, country: 'US' }], staged: true }, { action: 'publish' }]);
    const store = (await api.getByKey('channels', 'mcf-store-munich')) as Res;
    await api.update('channels', store, [{ action: 'setCustomField', name: 'phone', value: '000' }]);
    const inv = api.all('inventory')[0] as Res;
    await api.update('inventory', inv, [{ action: 'changeQuantity', quantity: 99999 }]);
    const tax = (await api.getByKey('tax-categories', 'mcf-tax-food')) as Res;
    const de = (tax.rates as { id: string; country: string; name: string; includedInPrice: boolean }[]).find((r) => r.country === 'DE') as { id: string; name: string; includedInPrice: boolean };
    await api.update('tax-categories', tax, [{ action: 'replaceTaxRate', taxRateId: de.id, taxRate: { name: de.name, amount: 0.5, includedInPrice: true, country: 'DE' } }]);
    const run = new Runner(false, quiet);
    const r = await runSeed({ ...opts(api), run });
    expect(r.changes).toBe(4); // prices (1 product), channel, inventory, tax
    expect(await runSeed(opts(api)).then((x) => x.changes)).toBe(0);
    expect(await verifySeed(api)).toEqual([]);
  });
});

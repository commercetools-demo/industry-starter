import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PATIENTS } from './data/patients';
import { MALVA_CONTAINERS } from './containers';
import { createFakeRoot } from './fake-root';
import { makeCtx, parseFlags } from './lib';
import { runReset } from './reset';
import { runSeed } from './seed';

const ctxOf = (fake: ReturnType<typeof createFakeRoot>, dryRun = false) => ({ ...makeCtx(fake.root, { dryRun }, () => {}), pauseMs: 0, sleep: async () => {} });

/** A seeded project plus customer-owned data: one synthetic patient with a cart, order, payment, list and recurring order, one real-looking customer. */
async function seededWithCustomerData() {
  const fake = createFakeRoot();
  await runSeed(ctxOf(fake), { clinical: true, patientPassword: 'pw' });
  const sam = fake.store.customers.find((c) => c.email === PATIENTS[0].email) as { id: string };
  const put = (kind: string, r: Record<string, unknown>) => fake.store[kind].push({ version: 1, ...r });
  put('customers', { id: 'cust-real', email: 'jordan@gmail.example', key: 'real' });
  put('carts', { id: 'cart-sam', customerId: sam.id });
  put('orders', { id: 'ord-sam', customerId: sam.id });
  put('payments', { id: 'pay-sam', customer: { typeId: 'customer', id: sam.id } });
  put('shoppingLists', { id: 'sl-sam', customer: { typeId: 'customer', id: sam.id } });
  put('recurringOrders', { id: 'ro-sam', customer: { typeId: 'customer', id: sam.id }, recurringOrderState: 'Active' });
  put('orders', { id: 'ord-guest', customerEmail: 'guest@example.com' });
  put('orders', { id: 'ord-real', customerEmail: 'person@gmail.example' });
  put('reviews', { id: 'rev-sam', customer: { typeId: 'customer', id: sam.id } });
  // one object in every known container, plus one the code does not know
  for (const container of [...MALVA_CONTAINERS, 'malva-future-thing']) await fake.root.customObjects().post({ body: { container, key: `k-${container}`, value: { n: 1 } } }).execute();
  await fake.root.customObjects().post({ body: { container: 'someone-elses', key: 'keep', value: {} } }).execute();
  return { fake, samId: sam.id };
}

describe('full cleanup before a full seeding (D-038)', () => {
  it('the container list covers every container in lib/ct/custom-objects.ts', () => {
    const source = readFileSync(path.join(process.cwd(), 'lib/ct/custom-objects.ts'), 'utf8');
    const block = source.slice(source.indexOf('export const CONTAINERS'), source.indexOf('} as const'));
    const names = [...block.matchAll(/'(malva-[a-z-]+)'/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThanOrEqual(13);
    expect([...MALVA_CONTAINERS].sort()).toEqual([...new Set(names)].sort());
  });

  it('--include-customers erases reviews, seeded resources, every malva-* object, recurrence policies, the example.com customers and their data', async () => {
    const { fake } = await seededWithCustomerData();
    const summary = await runReset(ctxOf(fake), { includeCustomers: true });
    for (const [kind, list] of Object.entries(fake.store)) {
      expect(list.filter((r) => String(r.key ?? '').startsWith('mlv-')), kind).toEqual([]);
    }
    expect(fake.store.reviews).toEqual([]);
    expect(fake.store.recurrencePolicies).toEqual([]);
    expect(fake.store.recurringOrders).toEqual([]);
    expect(fake.store.shoppingLists).toEqual([]);
    expect(fake.store.payments).toEqual([]);
    expect(fake.store.carts).toEqual([]);
    expect(fake.store.orders.map((o) => o.id)).toEqual(['ord-real']);
    expect(fake.store.customers.map((c) => c.id)).toEqual(['cust-real']);
    expect(fake.objects.objects.map((o) => o.container)).toEqual(['someone-elses']);
    expect(summary.customers).toBe(PATIENTS.length);
    // the customer-owned deletes use dataErasure
    expect(fake.log.filter((l) => ['customers', 'orders', 'carts', 'payments', 'reviews', 'recurringOrders', 'shoppingLists'].includes(l.kind) && l.op === 'delete').every((l) => l.dataErasure)).toBe(true);
    expect(fake.objects.calls.filter((c) => c.op === 'delete').every((c) => c.dataErasure)).toBe(true);
  });

  it('dependency order: recurring orders and customer data before products; reviews before products; custom types after the customers that use them', async () => {
    const { fake } = await seededWithCustomerData();
    await runReset(ctxOf(fake), { includeCustomers: true });
    const order = fake.log.filter((l) => l.op === 'delete').map((l) => l.kind);
    const first = (kind: string) => order.indexOf(kind);
    const last = (kind: string) => order.lastIndexOf(kind);
    expect(first('recurringOrders')).toBeLessThan(first('orders'));
    expect(last('customers')).toBeLessThan(first('products'));
    expect(last('reviews')).toBeLessThan(first('products'));
    expect(last('products')).toBeLessThan(first('productTypes'));
    expect(last('recurrencePolicies')).toBeLessThan(first('states'));
    expect(last('customers')).toBeLessThan(first('types'));
  });

  it('without --include-customers customers, their carts and orders stay (and the objects and seeded resources go)', async () => {
    const { fake } = await seededWithCustomerData();
    // a custom type that a customer still uses cannot go: the fake has no such rule, the real API says 400 and the message names the flag
    const before = fake.store.customers.length;
    await runReset(ctxOf(fake), { includeCustomers: false });
    expect(fake.store.customers).toHaveLength(before);
    expect(fake.store.orders.map((o) => o.id)).toEqual(expect.arrayContaining(['ord-sam', 'ord-guest', 'ord-real']));
    expect(fake.objects.objects.map((o) => o.container)).toEqual(['someone-elses']);
    expect(fake.store.reviews.filter((r) => String(r.key ?? '').startsWith('mlv-'))).toEqual([]);
  });

  it('dry run lists and deletes nothing', async () => {
    const { fake } = await seededWithCustomerData();
    const logged = fake.log.length;
    const calls = fake.objects.calls.filter((c) => c.op === 'delete').length;
    const lines: string[] = [];
    await runReset({ ...ctxOf(fake, true), log: (l: string) => lines.push(l) }, { includeCustomers: true });
    expect(fake.log.length).toBe(logged);
    expect(fake.objects.calls.filter((c) => c.op === 'delete').length).toBe(calls);
    expect(lines.some((l) => l.includes('customObject malva-booking/'))).toBe(true);
    expect(lines.some((l) => l.includes('recurringOrders ro-sam'))).toBe(true);
  });

  it('a reset project can be seeded again', async () => {
    const { fake } = await seededWithCustomerData();
    await runReset(ctxOf(fake), { includeCustomers: true });
    expect((await runSeed(ctxOf(fake), { clinical: true, patientPassword: 'pw' })).ok).toBe(true);
  });

  it('parseFlags reads --include-customers', () => {
    expect(parseFlags(['--include-customers']).includeCustomers).toBe(true);
    expect(parseFlags([]).includeCustomers).toBe(false);
  });
});

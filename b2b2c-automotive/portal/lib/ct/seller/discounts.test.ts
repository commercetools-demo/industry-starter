import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartRule, ProductRule } from '@/lib/catalog/discount-rule';
import { createFakeCommercetools, type FakeCommercetools } from '@/lib/portal/catalog-fixture-root';
import { clearCatalogCaches } from './catalog-data';

let fake: FakeCommercetools;
vi.mock('./catalog-root', () => ({ catalogRoot: async () => fake.root }));

import { bandProblems, createDiscount, createDiscountDraft, deleteDiscount, getDiscount, listDiscounts, reorderDiscounts, setDiscountActive, updateDiscount } from './discounts';

const NORTH = 'mau-reseller-north';
const SOUTH = 'mau-reseller-south';

beforeEach(() => {
  fake = createFakeCommercetools();
  clearCatalogCaches();
});

const idOfKey = (map: 'productDiscounts' | 'cartDiscounts', key: string) => [...fake.state[map].values()].find((d) => d.key === key)?.id as string;
const productRule = (name: string, percent = 5): ProductRule => ({ name: { 'en-US': name, 'de-DE': name }, scope: { kind: 'category', categoryId: 'cat-filters', label: 'Filters' }, effect: { kind: 'relative', percent } });
const cartRule = (name: string, extra: Partial<CartRule> = {}): CartRule => ({ name: { 'en-US': name, 'de-DE': name }, condition: { kind: 'cartTotalAtLeast', centAmount: 200000 }, effect: { kind: 'relative', percent: 3 }, stacking: 'Stacking', ...extra });

describe('listDiscounts', () => {
  it("list shows only this store's and Malva-funded discounts", async () => {
    const north = await listDiscounts(NORTH, 'product');
    expect(north.map((d) => d.key)).toEqual(['mau-pd-malva-filter-autumn', 'mau-pd-north-brake-week']);
    expect(north.map((d) => d.funded)).toEqual(['malva', 'store']);
    expect(north.map((d) => d.rank)).toEqual([null, 1]);
    expect((await listDiscounts(SOUTH, 'product')).map((d) => d.key)).toEqual(['mau-pd-malva-filter-autumn', 'mau-pd-south-battery-bonus']);
    expect((await listDiscounts(NORTH, 'cart')).map((d) => d.key)).toEqual(['mau-cd-malva-welcome', 'mau-cd-north-large-order']);
    expect((await listDiscounts(SOUTH, 'cart')).map((d) => d.key)).toEqual(['mau-cd-malva-welcome', 'mau-cd-south-brake-code']);
  });

  it('parses scope and effect into the vocabulary of the lists', async () => {
    const [malva, own] = await listDiscounts(NORTH, 'product');
    expect(malva).toMatchObject({ scope: { kind: 'category', label: 'Filter' }, effect: { kind: 'relative', percent: 10 }, isActive: true });
    expect(own).toMatchObject({ scope: { kind: 'category', categoryId: 'cat-brakes' }, effect: { kind: 'relative', percent: 8 } });
    expect(own.rule).toMatchObject({ scope: { kind: 'category', categoryId: 'cat-brakes' }, effect: { kind: 'relative', percent: 8 } });
    const cart = (await listDiscounts(NORTH, 'cart')).find((d) => d.key === 'mau-cd-north-large-order');
    expect(cart).toMatchObject({ scope: { kind: 'cartTotalAtLeast', centAmount: 200000 }, effect: { kind: 'relative', percent: 3 }, stacking: 'Stacking' });
    const code = (await listDiscounts(SOUTH, 'cart')).find((d) => d.key === 'mau-cd-south-brake-code');
    expect(code).toMatchObject({ code: 'SUEDKAMM-BRAKE5', scope: { kind: 'category', categoryId: 'cat-brakes' } });
  });

  it('a Malva-funded discount is recognised by fundedBy or the key prefix mau-pd-malva-', async () => {
    const created = await createDiscount(NORTH, 'cart', cartRule('Own'));
    fake.state.cartDiscounts.get(created.id)!.custom.fields.fundedBy = 'malva';
    const cart = await listDiscounts(NORTH, 'cart');
    expect(cart.find((d) => d.id === created.id)?.funded).toBe('malva');
    expect((await listDiscounts(NORTH, 'product'))[0]).toMatchObject({ key: 'mau-pd-malva-filter-autumn', funded: 'malva' });
  });
});

describe('ownership and locks', () => {
  it('foreign discount id answers 404 on read, patch, toggle and delete', async () => {
    const southProduct = idOfKey('productDiscounts', 'mau-pd-south-battery-bonus');
    const southCart = idOfKey('cartDiscounts', 'mau-cd-south-brake-code');
    for (const [kind, id] of [['product', southProduct], ['cart', southCart]] as const) {
      await expect(getDiscount(NORTH, kind, id)).rejects.toMatchObject({ status: 404 });
      await expect(updateDiscount(NORTH, kind, id, kind === 'product' ? productRule('x') : cartRule('x'))).rejects.toMatchObject({ status: 404 });
      await expect(setDiscountActive(NORTH, kind, id, false)).rejects.toMatchObject({ status: 404 });
      await expect(deleteDiscount(NORTH, kind, id)).rejects.toMatchObject({ status: 404 });
    }
    await expect(getDiscount(NORTH, 'product', 'nope')).rejects.toMatchObject({ status: 404 });
    expect(fake.writes()).toHaveLength(0);
  });

  it('Malva-funded discount: patch, toggle and delete are 403 LOCKED_MALVA_FUNDED', async () => {
    const product = idOfKey('productDiscounts', 'mau-pd-malva-filter-autumn');
    const cart = idOfKey('cartDiscounts', 'mau-cd-malva-welcome');
    for (const [kind, id] of [['product', product], ['cart', cart]] as const) {
      await expect(updateDiscount(NORTH, kind, id, kind === 'product' ? productRule('x') : cartRule('x'))).rejects.toMatchObject({ status: 403, code: 'LOCKED_MALVA_FUNDED' });
      await expect(setDiscountActive(NORTH, kind, id, false)).rejects.toMatchObject({ status: 403, code: 'LOCKED_MALVA_FUNDED' });
      await expect(deleteDiscount(NORTH, kind, id)).rejects.toMatchObject({ status: 403, code: 'LOCKED_MALVA_FUNDED' });
    }
    expect(fake.writes()).toHaveLength(0);
    expect((await getDiscount(NORTH, 'product', product)).funded).toBe('malva'); // reading is allowed
  });
});

describe('writes', () => {
  it('toggle off keeps the discount listed', async () => {
    const id = idOfKey('productDiscounts', 'mau-pd-north-brake-week');
    const off = await setDiscountActive(NORTH, 'product', id, false);
    expect(off.isActive).toBe(false);
    expect(fake.callsOf('productDiscount.update')[0]?.args).toMatchObject({ actions: [{ action: 'changeIsActive', isActive: false }] });
    expect((await listDiscounts(NORTH, 'product')).find((d) => d.id === id)).toMatchObject({ isActive: false });
    expect((await setDiscountActive(NORTH, 'product', id, true)).isActive).toBe(true);
  });

  it('new draft is inactive and unscheduled', async () => {
    const draft = await createDiscountDraft(NORTH, 'cart');
    expect(draft).toMatchObject({ isActive: false, draft: true, funded: 'store', name: { 'en-US': 'New cart rule (draft)' } });
    expect(draft.validFrom).toBeUndefined();
    expect(draft.validUntil).toBeUndefined();
    const body = fake.callsOf('cartDiscount.create')[0]?.args as Record<string, unknown>;
    expect(body).toMatchObject({ isActive: false, value: { type: 'relative', permyriad: 1 }, stores: [{ typeId: 'store', key: NORTH }], custom: { fields: { fundedBy: 'reseller', storeKey: NORTH } } });
    expect(String(body.key)).toMatch(/^mau-reseller-north-new-[a-z0-9]{4}-draft$/);
    const product = await createDiscountDraft(NORTH, 'product');
    expect(product).toMatchObject({ isActive: false, draft: true });
    expect((fake.callsOf('productDiscount.create')[0]?.args as { predicate: string }).predicate).toBe('true and channel.id = "ch-mau-dist-north"');
  });

  it('a draft cannot be activated until the rule is saved; saving renames the key', async () => {
    const draft = await createDiscountDraft(NORTH, 'cart');
    await expect(setDiscountActive(NORTH, 'cart', draft.id, true)).rejects.toMatchObject({ status: 400, code: 'DRAFT_INCOMPLETE' });
    const saved = await updateDiscount(NORTH, 'cart', draft.id, cartRule('Cart -3%'));
    expect(saved.draft).toBe(false);
    expect(saved.key).toMatch(/^mau-reseller-north-cart-3-[a-z0-9]{4}$/);
    expect((await setDiscountActive(NORTH, 'cart', draft.id, true)).isActive).toBe(true);
  });

  it('a T-created cart discount carries stores and mau-cart-discount-fields (fundedBy reseller, storeKey), inactive, sortOrder in the reseller band', async () => {
    const created = await createDiscount(NORTH, 'cart', cartRule('Cart -3%'));
    expect(fake.callsOf('cartDiscount.create')[0]?.args).toMatchObject({
      isActive: false,
      stores: [{ typeId: 'store', key: NORTH }],
      custom: { type: { typeId: 'type', key: 'mau-cart-discount-fields' }, fields: { fundedBy: 'reseller', storeKey: NORTH } },
      cartPredicate: 'totalPrice >= "2000.00 EUR"',
      target: { type: 'totalPrice' },
    });
    expect(Number(created.sortOrder)).toBeGreaterThanOrEqual(0.05);
    expect(Number(created.sortOrder)).toBeLessThanOrEqual(0.89);
    expect(created.rule).toMatchObject({ condition: { kind: 'cartTotalAtLeast', centAmount: 200000 }, effect: { percent: 3 } });
  });

  it('a product discount carries the store channel clause and is inactive', async () => {
    await createDiscount(NORTH, 'product', productRule('Filters -5%'));
    expect(fake.callsOf('productDiscount.create')[0]?.args).toMatchObject({ predicate: 'categories.id contains any ("cat-filters") and channel.id = "ch-mau-dist-north"', isActive: false, value: { type: 'relative', permyriad: 500 } });
  });

  it('edit cannot drop the channel clause or stores', async () => {
    const product = await createDiscount(NORTH, 'product', productRule('Filters -5%'));
    await updateDiscount(NORTH, 'product', product.id, { ...productRule('Filters -6%', 6), scope: { kind: 'all' } });
    expect(fake.state.productDiscounts.get(product.id)?.predicate).toBe('true and channel.id = "ch-mau-dist-north"');
    const cart = await createDiscount(NORTH, 'cart', cartRule('Cart'));
    await updateDiscount(NORTH, 'cart', cart.id, cartRule('Cart 4%', { effect: { kind: 'relative', percent: 4 } }));
    const stored = fake.state.cartDiscounts.get(cart.id);
    expect(stored?.stores).toEqual([{ typeId: 'store', key: NORTH }]);
    const actions = (fake.callsOf('cartDiscount.update').at(-1)?.args as { actions: { action: string }[] }).actions.map((a) => a.action);
    expect(actions).not.toContain('setStores');
    expect(actions).not.toContain('removeStore');
    expect(actions).not.toContain('setCustomField');
  });

  it('validation: 0%, 101% and a schedule that ends before it starts are 400 INVALID_RULE with the field', async () => {
    await expect(createDiscount(NORTH, 'product', productRule('x', 0))).rejects.toMatchObject({ status: 400, code: 'INVALID_RULE', details: { issues: [{ field: 'effect' }] } });
    await expect(createDiscount(NORTH, 'product', productRule('x', 101))).rejects.toMatchObject({ code: 'INVALID_RULE' });
    await expect(createDiscount(NORTH, 'cart', cartRule('x', { validFrom: '2026-12-01T00:00:00Z', validUntil: '2026-11-01T00:00:00Z' }))).rejects.toMatchObject({ details: { issues: [{ field: 'validUntil' }] } });
    expect(fake.writes()).toHaveLength(0);
  });

  it('Q-X08: 100%, an absolute amount at or above the lowest price in scope, and a cart amount at or above its threshold are 400 INVALID_RULE and nothing is written', async () => {
    const absolute = (scope: ProductRule['scope'], centAmount: number): ProductRule => ({ name: { 'en-US': 'Abs', 'de-DE': 'Abs' }, scope, effect: { kind: 'absolute', centAmount } });
    await expect(createDiscount(NORTH, 'product', productRule('x', 100))).rejects.toMatchObject({ status: 400, code: 'INVALID_RULE' });
    await expect(createDiscount(NORTH, 'cart', cartRule('x', { effect: { kind: 'relative', percent: 100 } }))).rejects.toMatchObject({ code: 'INVALID_RULE' });
    await expect(createDiscount(NORTH, 'product', absolute({ kind: 'skus', skus: ['MLV-OF-44001'] }, 1290))).rejects.toMatchObject({ status: 400, code: 'INVALID_RULE' }); // price 12.90
    await expect(createDiscount(NORTH, 'product', absolute({ kind: 'skus', skus: ['MLV-OF-44001', 'MLV-BP-41001'] }, 5000))).rejects.toMatchObject({ code: 'INVALID_RULE' }); // below one price, above another
    await expect(createDiscount(NORTH, 'product', absolute({ kind: 'all' }, 1290))).rejects.toMatchObject({ code: 'INVALID_RULE' });
    await expect(createDiscount(NORTH, 'cart', cartRule('x', { effect: { kind: 'absolute', centAmount: 200000 } }))).rejects.toMatchObject({ code: 'INVALID_RULE' });
    await expect(createDiscount(NORTH, 'cart', cartRule('x', { condition: { kind: 'always' }, effect: { kind: 'absolute', centAmount: 500 } }))).rejects.toMatchObject({ code: 'INVALID_RULE' });
    expect(fake.writes()).toHaveLength(0);
    const ok = await createDiscount(NORTH, 'product', absolute({ kind: 'skus', skus: ['MLV-OF-44001'] }, 1289));
    expect(ok.isActive).toBe(false);
    await expect(updateDiscount(NORTH, 'product', ok.id, absolute({ kind: 'skus', skus: ['MLV-OF-44001'] }, 1290))).rejects.toMatchObject({ code: 'INVALID_RULE' });
  });

  it('delete removes a store discount', async () => {
    const created = await createDiscount(NORTH, 'cart', cartRule('Gone'));
    await deleteDiscount(NORTH, 'cart', created.id);
    expect(fake.state.cartDiscounts.has(created.id)).toBe(false);
  });

  it('retries a toggle on a version conflict with the latest version', async () => {
    fake.conflictOnce('productDiscount.update');
    const id = idOfKey('productDiscounts', 'mau-pd-north-brake-week');
    await setDiscountActive(NORTH, 'product', id, false);
    const versions = fake.callsOf('productDiscount.update').map((c) => (c.args as { version: number }).version);
    expect(versions[1]).toBeGreaterThan(versions[0]);
  });
});

describe('discount codes', () => {
  it('a cart rule with a code creates an active discount code and requires it', async () => {
    const created = await createDiscount(NORTH, 'cart', cartRule('Brake 5%', { code: 'BRAKE5', condition: { kind: 'category', categoryId: 'cat-brakes' }, effect: { kind: 'relative', percent: 5 } }));
    expect(fake.state.cartDiscounts.get(created.id)).toMatchObject({ requiresDiscountCode: true, target: { type: 'lineItems' } });
    expect(fake.callsOf('code.create')[0]?.args).toMatchObject({ code: 'BRAKE5', isActive: true, cartDiscounts: [{ typeId: 'cart-discount', id: created.id }] });
    expect(created.code).toBe('BRAKE5');
  });

  it('duplicate discount code is 409 CODE_TAKEN and nothing is created', async () => {
    await expect(createDiscount(SOUTH, 'cart', cartRule('Dup', { code: 'SUEDKAMM-BRAKE5' }))).rejects.toMatchObject({ status: 409, code: 'CODE_TAKEN' });
    expect(fake.callsOf('cartDiscount.create')).toHaveLength(0);
    await expect(createDiscount(SOUTH, 'cart', cartRule('Bad', { code: 'a b' }))).rejects.toMatchObject({ code: 'INVALID_RULE' });
  });

  it('saving the same rule again does not create a second code', async () => {
    const created = await createDiscount(NORTH, 'cart', cartRule('Code', { code: 'SAVE10' }));
    await updateDiscount(NORTH, 'cart', created.id, cartRule('Code', { code: 'SAVE10' }));
    expect(fake.callsOf('code.create')).toHaveLength(1);
  });
});

describe('priority', () => {
  async function threeProducts() {
    const a = idOfKey('productDiscounts', 'mau-pd-north-brake-week');
    const b = (await createDiscount(NORTH, 'product', productRule('B', 5))).id;
    const c = (await createDiscount(NORTH, 'product', productRule('C', 6))).id;
    return { a, b, c };
  }

  it('priority writes sortOrder so rank 1 > rank 2 > rank 3, permuting the store own values', async () => {
    const { a, b, c } = await threeProducts();
    const before = [a, b, c].map((id) => fake.state.productDiscounts.get(id)!.sortOrder).sort();
    // New discounts get a random sortOrder in the band, so "c, a, b" was already the held order one run in six (flaky): ask for the
    // opposite of what is held when that happens.
    const held = (await listDiscounts(NORTH, 'product')).filter((d) => d.funded === 'store').map((d) => d.id);
    const wanted = held.join() === [c, a, b].join() ? [b, a, c] : [c, a, b];
    const result = await reorderDiscounts(NORTH, 'product', wanted);
    expect(result.changed).toBeGreaterThan(0);
    const orders = wanted.map((id) => fake.state.productDiscounts.get(id)!.sortOrder);
    expect(Number(orders[0])).toBeGreaterThan(Number(orders[1]));
    expect(Number(orders[1])).toBeGreaterThan(Number(orders[2]));
    expect([...orders].sort()).toEqual(before); // a permutation of the original values
    const listed = (await listDiscounts(NORTH, 'product')).filter((d) => d.funded === 'store');
    expect(listed.map((d) => d.id)).toEqual(wanted);
    expect(listed.map((d) => d.rank)).toEqual([1, 2, 3]);
    // the Malva-funded discount still outranks every reseller discount
    expect(bandProblems(await listDiscounts(NORTH, 'product'))).toEqual([]);
  });

  it('writing the order that already holds changes nothing', async () => {
    const { a, b, c } = await threeProducts();
    const current = (await listDiscounts(NORTH, 'product')).filter((d) => d.funded === 'store').map((d) => d.id);
    fake.resetCalls();
    expect(await reorderDiscounts(NORTH, 'product', current)).toEqual({ changed: 0 });
    expect(fake.writes()).toHaveLength(0);
    expect(new Set(current)).toEqual(new Set([a, b, c]));
  });

  it('priority: stale list is 409; a cart id or a Malva id in a product list is 409 (a row cannot cross out of its kind)', async () => {
    const { a, b } = await threeProducts();
    await expect(reorderDiscounts(NORTH, 'product', [a, b])).rejects.toMatchObject({ status: 409, code: 'STALE_LIST' });
    const cart = idOfKey('cartDiscounts', 'mau-cd-north-large-order');
    await expect(reorderDiscounts(NORTH, 'product', [a, b, cart])).rejects.toMatchObject({ status: 409, code: 'STALE_LIST' });
    const malva = idOfKey('productDiscounts', 'mau-pd-malva-filter-autumn');
    await expect(reorderDiscounts(NORTH, 'product', [malva, a, b])).rejects.toMatchObject({ code: 'STALE_LIST' });
    await expect(reorderDiscounts(NORTH, 'product', [a, a, b])).rejects.toMatchObject({ code: 'STALE_LIST' });
    expect(fake.writes().filter((w) => w.op.endsWith('.update'))).toHaveLength(0);
  });

  it("another store's discounts are not part of the list", async () => {
    const south = idOfKey('productDiscounts', 'mau-pd-south-battery-bonus');
    const a = idOfKey('productDiscounts', 'mau-pd-north-brake-week');
    await expect(reorderDiscounts(NORTH, 'product', [a, south])).rejects.toMatchObject({ code: 'STALE_LIST' });
  });
});

describe('band check', () => {
  it('flags a Malva-funded discount that ranks below a reseller discount', () => {
    const problems = bandProblems([
      { key: 'mau-pd-malva-x', funded: 'malva', sortOrder: '0.11' },
      { key: 'mau-pd-north-y', funded: 'store', sortOrder: '0.51' },
    ]);
    expect(problems.length).toBe(2);
    expect(problems[0]).toContain('mau-pd-malva-x');
  });
});

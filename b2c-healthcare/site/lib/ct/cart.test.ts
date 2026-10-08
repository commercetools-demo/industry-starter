// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeCarts, type FakeCarts } from '@/test/fake-carts';
import type { RxLineView } from '@/lib/types';

let fake: FakeCarts;
vi.mock('@/lib/ct/client', () => ({ apiRoot: new Proxy({}, { get: (_t, p) => (fake.apiRoot as Record<string, unknown>)[p as string] }) }));

const { RxNotFoundError, validateRxSelection } = vi.hoisted(() => ({ RxNotFoundError: class extends Error {}, validateRxSelection: vi.fn() }));
vi.mock('@/lib/ct/prescriptions', () => ({ RxNotFoundError, validateRxSelection: (...a: unknown[]) => validateRxSelection(...a) }));

import { addRxLines, getCartSummary, getCartValidated, getOrCreateCart, removeLine, STANDARD_SHIPPING_KEY } from './cart';

const ctx = { locale: 'en-US', currency: 'USD', country: 'US' };
const patient = { patientRef: 'pt_sam', name: 'Sam Rivera' };
const sel = (lineRef: string, sku: string, qty = 30) => ({ lineRef, sku, qty, packs: 1, price: null, perOrderMax: null, periodCeiling: null });
const row = (lineRef: string, over: Partial<RxLineView> = {}): RxLineView => ({
  lineRef, name: '', sig: '', qty: 30, price: null, status: 'NO_REFILLS', selectable: false, minShelfLifeMonths: null, ...over,
});

beforeEach(() => {
  fake = createFakeCarts({ 'MED-ator': 1875, 'MED-lis': 1140 });
  validateRxSelection.mockReset().mockResolvedValue({ rxNumber: 'RX-77102', accepted: [], refused: [] });
});

describe('cart-management: cart creation and lines (O-01)', () => {
  it('creates a customer cart on the first add with region, Platform tax, Single shipping and the standard method', async () => {
    const { cart } = await addRxLines('c-sam', undefined, 'RX-77102', [sel('RX-77102-1', 'MED-ator')], ctx);
    expect(fake.creates).toEqual([
      expect.objectContaining({ currency: 'USD', country: 'US', customerId: 'c-sam', shippingMode: 'Single', taxMode: 'Platform', shippingMethod: { typeId: 'shipping-method', key: STANDARD_SHIPPING_KEY } }),
    ]);
    expect(fake.creates[0]).not.toHaveProperty('anonymousId');
    expect(cart.lineCount).toBe(1);
  });

  it('adds lines by SKU with the prescription fields and the packs as quantity', async () => {
    await addRxLines('c-sam', undefined, 'RX-77102', [sel('RX-77102-1', 'MED-ator'), sel('RX-77102-2', 'MED-lis')], ctx);
    const actions = fake.updates[0]?.actions ?? [];
    expect(actions).toEqual([
      { action: 'addLineItem', sku: 'MED-ator', quantity: 1, custom: { type: { typeId: 'type', key: 'mlv-rx-line' }, fields: { rxNumber: 'RX-77102', rxLineRef: 'RX-77102-1', prescribedQty: 30 } } },
      { action: 'addLineItem', sku: 'MED-lis', quantity: 1, custom: { type: { typeId: 'type', key: 'mlv-rx-line' }, fields: { rxNumber: 'RX-77102', rxLineRef: 'RX-77102-2', prescribedQty: 30 } } },
    ]);
  });

  it('maps totals from the platform response: cart total, shipping and the line totals', async () => {
    const { cart } = await addRxLines('c-sam', undefined, 'RX-77102', [sel('RX-77102-1', 'MED-ator'), sel('RX-77102-2', 'MED-lis')], ctx);
    expect(cart.total.centAmount).toBe(3015);
    expect(cart.subtotal?.centAmount).toBe(3015);
    expect(cart.shipping).toMatchObject({ name: 'Standard delivery', price: { centAmount: 0 } });
    expect(cart.lines[0]).toMatchObject({ rxNumber: 'RX-77102', rxLineRef: 'RX-77102-1', prescribedQty: 30, unitPrice: { centAmount: 1875 } });
  });

  it('uses the existing cart of the session', async () => {
    const first = await getOrCreateCart('c-sam', undefined, ctx);
    await addRxLines('c-sam', first.id, 'RX-77102', [sel('RX-77102-1', 'MED-ator')], ctx);
    expect(fake.carts.size).toBe(1);
  });

  it('a stale cartId is tolerated: the customer gets their Active cart or a new one', async () => {
    const own = await getOrCreateCart('c-sam', undefined, ctx);
    expect((await getOrCreateCart('c-sam', 'gone', ctx)).id).toBe(own.id);
    expect((await getOrCreateCart('c-alex', 'gone', ctx)).id).not.toBe(own.id);
  });

  it("never uses another customer's cart even when the id is known", async () => {
    const other = await getOrCreateCart('c-alex', undefined, ctx);
    const mine = await getOrCreateCart('c-sam', other.id, ctx);
    expect(mine.id).not.toBe(other.id);
    expect(mine.customerId).toBe('c-sam');
  });

  it('a cart that is no longer Active is not reused', async () => {
    const old = await getOrCreateCart('c-sam', undefined, ctx);
    fake.carts.get(old.id)!.cartState = 'Ordered';
    expect((await getOrCreateCart('c-sam', old.id, ctx)).id).not.toBe(old.id);
  });

  it('Remove: removes the line and returns the recalculated cart', async () => {
    const { cart } = await addRxLines('c-sam', undefined, 'RX-77102', [sel('RX-77102-1', 'MED-ator'), sel('RX-77102-2', 'MED-lis')], ctx);
    const out = await removeLine('c-sam', cart.id, cart.lines[0]!.id);
    expect(out?.cart.lineCount).toBe(1);
    expect(out?.cart.total.centAmount).toBe(1140);
  });

  it('Last line removed: the cart is empty with no subtotal', async () => {
    const { cart } = await addRxLines('c-sam', undefined, 'RX-77102', [sel('RX-77102-1', 'MED-ator')], ctx);
    const out = await removeLine('c-sam', cart.id, cart.lines[0]!.id);
    expect(out?.cart).toMatchObject({ lineCount: 0, subtotal: null, lines: [] });
  });

  it('removing a line that is already gone is not an error', async () => {
    const { cart } = await addRxLines('c-sam', undefined, 'RX-77102', [sel('RX-77102-1', 'MED-ator')], ctx);
    const out = await removeLine('c-sam', cart.id, 'nope');
    expect(out?.cart.lineCount).toBe(1);
  });

  it('a version conflict is retried once with the refetched version', async () => {
    const { cart } = await addRxLines('c-sam', undefined, 'RX-77102', [sel('RX-77102-1', 'MED-ator')], ctx);
    fake.failNextUpdate = { statusCode: 409 };
    const out = await removeLine('c-sam', cart.id, cart.lines[0]!.id);
    expect(out?.cart.lineCount).toBe(0);
  });

  it('summary: null when the customer has no cart', async () => {
    expect(await getCartSummary('c-sam', undefined)).toBeNull();
  });
});

describe('design-cart › No quantity editing / Replace-not-duplicate (O-03)', () => {
  it('adding the same prescription line twice replaces the line instead of duplicating it', async () => {
    const first = await addRxLines('c-sam', undefined, 'RX-77102', [sel('RX-77102-1', 'MED-ator')], ctx);
    const second = await addRxLines('c-sam', first.cart.id, 'RX-77102', [sel('RX-77102-1', 'MED-ator')], ctx);
    expect(second.cart.lineCount).toBe(1);
    expect(second.cart.lines[0]!.id).not.toBe(first.cart.lines[0]!.id);
    expect(fake.updates[1]?.actions.map((a) => a.action)).toEqual(['removeLineItem', 'addLineItem']);
    expect(second.cart.total.centAmount).toBe(1875);
  });

  it('the same medication from another prescription is a separate line', async () => {
    const first = await addRxLines('c-sam', undefined, 'RX-77102', [sel('RX-77102-1', 'MED-ator')], ctx);
    const second = await addRxLines('c-sam', first.cart.id, 'RX-90000', [sel('RX-90000-1', 'MED-ator')], ctx);
    expect(second.cart.lineCount).toBe(2);
  });
});

describe('design-cart › Lines that stopped being dispensable (O-04)', () => {
  const twoLines = () => addRxLines('c-sam', undefined, 'RX-77102', [sel('RX-77102-1', 'MED-ator'), sel('RX-77102-2', 'MED-lis')], ctx);

  it('Prescription expired or refills used: the line is flagged with the typed reason and stays in the cart', async () => {
    const { cart } = await twoLines();
    validateRxSelection.mockResolvedValue({ rxNumber: 'RX-77102', accepted: [sel('RX-77102-2', 'MED-lis')], refused: [row('RX-77102-1', { status: 'EXPIRED' })] });
    const out = await getCartValidated(patient, 'c-sam', cart.id, ctx);
    expect(out?.lines).toHaveLength(2);
    expect(out?.lines[0]?.unavailable).toEqual({ reason: 'EXPIRED' });
    expect(out?.lines[1]?.unavailable).toBeUndefined();
    expect(out?.unavailableCount).toBe(1);
  });

  it.each([
    ['NO_REFILLS', { remaining: 0 }],
    ['OUT_OF_STOCK', { remaining: 0 }],
    ['CEILING', { ceiling: 2, remaining: 1, scope: 'period' as const }],
    ['SHELF_LIFE', { expiryDate: '2026-11-15' }],
  ] as const)('reason %s is carried with its details', async (status, extra) => {
    const { cart } = await twoLines();
    validateRxSelection.mockResolvedValue({ rxNumber: 'RX-77102', accepted: [], refused: [row('RX-77102-1', { status, ...extra })] });
    const out = await getCartValidated(patient, 'c-sam', cart.id, ctx);
    expect(out?.lines[0]?.unavailable).toEqual({ reason: status, ...extra });
  });

  it('a prescription that can no longer be found makes its lines unavailable', async () => {
    const { cart } = await twoLines();
    validateRxSelection.mockRejectedValue(new RxNotFoundError());
    const out = await getCartValidated(patient, 'c-sam', cart.id, ctx);
    expect(out?.lines.map((l) => l.unavailable?.reason)).toEqual(['UNAVAILABLE', 'UNAVAILABLE']);
  });

  it('every line is re-validated, once per prescription, and nothing is removed by the server', async () => {
    const { cart } = await twoLines();
    validateRxSelection.mockResolvedValue({ rxNumber: 'RX-77102', accepted: [], refused: [row('RX-77102-1'), row('RX-77102-2')] });
    await getCartValidated(patient, 'c-sam', cart.id, ctx);
    expect(validateRxSelection).toHaveBeenCalledTimes(1);
    expect(validateRxSelection.mock.calls[0]?.slice(1, 3)).toEqual(['RX-77102', ['RX-77102-1', 'RX-77102-2']]);
    expect(fake.updates.flatMap((u) => u.actions).some((a) => a.action === 'removeLineItem')).toBe(false);
    expect(fake.carts.get(cart.id)!.lineItems).toHaveLength(2);
  });

  it('recalculates with updateProductData on read', async () => {
    const { cart } = await twoLines();
    await getCartValidated(patient, 'c-sam', cart.id, ctx);
    expect(fake.updates.some((u) => u.actions.some((a) => a.action === 'recalculate' && a.updateProductData === true))).toBe(true);
  });

  it('Price changed: the new price shows with a "Price updated" mark once, then the price seen is stored', async () => {
    const { cart } = await twoLines();
    const first = await getCartValidated(patient, 'c-sam', cart.id, ctx);
    expect(first?.lines.some((l) => l.priceUpdated)).toBe(false);
    fake.prices.set('MED-ator', 2000);
    const second = await getCartValidated(patient, 'c-sam', cart.id, ctx);
    expect(second?.lines[0]).toMatchObject({ priceUpdated: true, unitPrice: { centAmount: 2000 } });
    expect(second?.lines[1]?.priceUpdated).toBe(false);
    expect(second?.total.centAmount).toBe(3140);
    const third = await getCartValidated(patient, 'c-sam', cart.id, ctx);
    expect(third?.lines[0]?.priceUpdated).toBe(false);
  });

  it('a cart with no lines is returned without re-validation or writes', async () => {
    const { cart } = await twoLines();
    await removeLine('c-sam', cart.id, cart.lines[0]!.id);
    await removeLine('c-sam', cart.id, cart.lines[1]!.id);
    validateRxSelection.mockClear();
    const writes = fake.updates.length;
    expect((await getCartValidated(patient, 'c-sam', cart.id, ctx))?.lineCount).toBe(0);
    expect(validateRxSelection).not.toHaveBeenCalled();
    expect(fake.updates).toHaveLength(writes);
  });

  it('null when the customer has no cart', async () => {
    expect(await getCartValidated(patient, 'c-sam', undefined, ctx)).toBeNull();
  });
});

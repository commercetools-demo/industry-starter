// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeObjects, type FakeObjects } from '@/test/fake-custom-objects';
import { createFakeShop, type FakeShop } from '@/test/fake-shop';
import { checkoutCreatesOrder, makePlaceOrder } from '@/test/checkout-flow';
import { createFakePaymentProvider } from '@/lib/checkout/fake-provider';
import type { Prescription } from '@/lib/clinical/types';

let shop: FakeShop;
let objects: FakeObjects;
vi.mock('@/lib/ct/client', () => ({
  apiRoot: new Proxy({}, {
    get: (_t, p) => (p === 'customObjects' ? objects.customObjects : (shop.apiRoot as Record<string, unknown>)[p as string]),
  }),
}));

const rxMocks = vi.hoisted(() => ({ validateRxSelection: vi.fn(), findOwnPrescription: vi.fn(), RxNotFoundError: class extends Error {} }));
vi.mock('@/lib/ct/prescriptions', () => rxMocks);
vi.mock('@/lib/ct/rx-catalog', () => ({ getCatalogBySku: async () => new Map() }));
vi.mock('@/lib/ct/patient', () => ({ getPatient: async () => ({ patientRef: 'pt_sam', name: 'Sam Rivera' }) }));

import { CONTAINERS } from '@/lib/ct/custom-objects';
import type { CheckoutContext } from '@/lib/ct/checkout';
import * as orders from './orders';
import { finalizeOrder, needsFinalize, prepareCheckout } from './orders';

const provider = createFakePaymentProvider();
const placeOrder = (input: Parameters<ReturnType<typeof makePlaceOrder>>[0], options?: { cardCents?: number }) => makePlaceOrder(shop, orders)(input, provider, options);
const MORNING = new Date('2026-10-08T09:00:00-04:00');
const AFTERNOON = new Date('2026-10-08T15:00:00-04:00');
const ctx = (now = MORNING, customerId = 'c-sam'): CheckoutContext => ({ patient: { patientRef: 'pt_sam', name: 'Sam Rivera' }, customerId, cartId: undefined, rx: { locale: 'en-US', currency: 'USD', country: 'US' }, now });
const ADDRESS = { country: 'US', state: 'NY', streetName: '12 Elm St', city: 'New York', postalCode: '10001', firstName: 'Sam', lastName: 'Rivera', phone: '+15125550100' };

const rx = (over: Partial<Prescription> = {}): Prescription => ({
  number: 'RX-77102', patientRef: 'pt_sam', prescriber: 'Dr. Test', issuedAt: '2026-09-24', refillsLeft: 3,
  lines: [{ lineRef: 'RX-77102-1', sku: 'MED-ator', name: 'A', sig: 'sig', qty: 30 }],
  ...over,
});
const selected = { lineRef: 'RX-77102-1', sku: 'MED-ator', qty: 30, packs: 1, price: null, perOrderMax: null, periodCeiling: null };
const storeRx = (r: Prescription) => objects.objects.push({ id: `o-${r.number}`, container: CONTAINERS.rx, key: r.number, version: 1, value: r, createdAt: '', lastModifiedAt: '' });
const storedRx = () => objects.objects.find((o) => o.container === CONTAINERS.rx)?.value as Prescription;

function readyCart(over: Parameters<FakeShop['seedCart']>[0] = {}) {
  return shop.seedCart({ shippingAddress: ADDRESS, ...over });
}
const totalOf = (cartId: string) => {
  const c = shop.carts.get(cartId)!;
  const t = c.taxedPrice?.totalGross ?? c.totalPrice;
  return { centAmount: t.centAmount, currencyCode: t.currencyCode };
};
const input = (cartId: string, over: { ctx?: CheckoutContext; expectedTotal?: { centAmount: number; currencyCode: string } } = {}) => ({ ctx: ctx(), cartId, expectedTotal: totalOf(cartId), ...over });

beforeEach(() => {
  shop = createFakeShop();
  objects = createFakeObjects();
  provider.reset();
  storeRx(rx());
  rxMocks.validateRxSelection.mockReset().mockResolvedValue({ rxNumber: 'RX-77102', accepted: [selected], refused: [] });
  rxMocks.findOwnPrescription.mockReset().mockImplementation(async () => rx({ refillsLeft: storedRx()?.refillsLeft ?? 3 }));
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('checkout: prepareCheckout, the gate before Checkout (AA)', () => {
  it('a cart that passes every check gets a Checkout session and NO order: Checkout creates it later', async () => {
    const cart = readyCart();
    const gate = await prepareCheckout(input(cart.id), provider);
    // The demo provider stands in for Checkout in tests; the real adapter answers kind "checkout" with the same session.
    expect(gate).toMatchObject({ ok: true, kind: 'demo', cardDue: 1875 });
    expect(shop.orders).toHaveLength(0);
    expect(shop.orderCreates).toHaveLength(0);
    expect(shop.carts.get(cart.id)?.cartState).toBe('Active');
    expect(storedRx().refillsLeft).toBe(3);
  });

  it('writes the N-09 line records on the cart lines before Checkout runs (the platform copies them to the order)', async () => {
    const cart = readyCart();
    await prepareCheckout(input(cart.id), provider);
    const fields = shop.carts.get(cart.id)!.lineItems[0].custom?.fields as Record<string, unknown>;
    expect(fields).toMatchObject({ rxNumber: 'RX-77102', rxLineRef: 'RX-77102-1', dispensedQty: 30 });
    expect(JSON.parse(String(fields.authorizationParams))).toMatchObject({ issuedAt: '2026-09-24', refillsBefore: 3 });
    expect(JSON.parse(String(fields.suppliedLots))).toEqual([]);
  });

  it('is safe to run again: the same cart, the same records, still no order', async () => {
    const cart = readyCart();
    await prepareCheckout(input(cart.id), provider);
    const again = await prepareCheckout(input(cart.id), provider);
    expect(again).toMatchObject({ ok: true, kind: 'demo' });
    expect(shop.orders).toHaveLength(0);
  });

  it('Totals moved: the cart no longer says the amount the buyer saw, so no session is created', async () => {
    const cart = readyCart();
    const outcome = await prepareCheckout(input(cart.id, { expectedTotal: { centAmount: 1500, currencyCode: 'USD' } }), provider);
    expect(outcome).toEqual({ ok: false, code: 'TOTALS_MOVED' });
    expect(shop.orders).toHaveLength(0);
    expect(shop.carts.get(cart.id)!.lineItems[0].custom?.fields).not.toHaveProperty('dispensedQty');
  });

  it('re-validates the lines: a line that can no longer be filled blocks Checkout and names the line', async () => {
    const cart = readyCart();
    rxMocks.validateRxSelection.mockResolvedValue({
      rxNumber: 'RX-77102', accepted: [],
      refused: [{ lineRef: 'RX-77102-1', name: '', sig: '', qty: 30, price: null, status: 'NO_REFILLS', selectable: false, remaining: 0, minShelfLifeMonths: null }],
    });
    expect(await prepareCheckout(input(cart.id), provider)).toEqual({ ok: false, code: 'LINES_UNAVAILABLE', lineIds: [shop.carts.get(cart.id)!.lineItems[0].id] });
  });

  it('a prescription that can no longer be found blocks Checkout too', async () => {
    const cart = readyCart();
    rxMocks.validateRxSelection.mockRejectedValue(new rxMocks.RxNotFoundError());
    expect((await prepareCheckout(input(cart.id), provider)).ok).toBe(false);
  });

  it('same-day chosen before 14:00 but continued after the cut-off is refused (D-033)', async () => {
    const cart = readyCart({ methodKey: 'mlv-same-day' });
    expect(await prepareCheckout(input(cart.id, { ctx: ctx(AFTERNOON) }), provider)).toEqual({ ok: false, code: 'NO_DELIVERY_METHOD' });
    expect(await prepareCheckout(input(cart.id, { ctx: ctx(MORNING) }), provider)).toMatchObject({ ok: true });
  });

  it('refuses without an address, and never prepares another customer\'s cart', async () => {
    const bare = shop.seedCart();
    expect(await prepareCheckout(input(bare.id), provider)).toEqual({ ok: false, code: 'ADDRESS_MISSING' });
    const other = readyCart({ customerId: 'c-other' });
    expect(await prepareCheckout(input(other.id), provider)).toEqual({ ok: false, code: 'EMPTY_CART' });
  });

  it('an empty or missing cart is EMPTY_CART', async () => {
    const empty = readyCart({ lines: [] });
    expect(await prepareCheckout(input(empty.id), provider)).toEqual({ ok: false, code: 'EMPTY_CART' });
    expect(await prepareCheckout({ ctx: ctx(), cartId: 'cart-nope', expectedTotal: { centAmount: 1, currencyCode: 'USD' } }, provider)).toEqual({ ok: false, code: 'EMPTY_CART' });
  });

  it('a cart Checkout already turned into an order answers with that order, finalized', async () => {
    const cart = readyCart();
    const order = await checkoutCreatesOrder(shop, cart.id);
    const gate = await prepareCheckout(input(cart.id), provider);
    expect(gate).toMatchObject({ ok: true, kind: 'order', orderId: order.id, orderNumber: 'MLV-000001' });
    expect(storedRx().refillsLeft).toBe(2);
  });
});

describe('checkout: finalizeOrder, the domain logic once per order (AA)', () => {
  it('Success: the number MLV-000001 and state mlv-received are set, the prescription is consumed once, the totals are the order\'s own', async () => {
    const cart = readyCart();
    const outcome = await placeOrder(input(cart.id));
    expect(outcome).toMatchObject({ ok: true, replay: false, orderNumber: 'MLV-000001' });
    expect(shop.orders).toHaveLength(1);
    const order = shop.orders[0];
    expect(order).toMatchObject({ orderNumber: 'MLV-000001', customerId: 'c-sam', cart: { id: cart.id } });
    expect(order.state?.key).toBe('mlv-received');
    expect(order.totalPrice.centAmount).toBe(1875);
    const fields = order.lineItems[0].custom?.fields as Record<string, unknown>;
    expect(fields).toMatchObject({ rxNumber: 'RX-77102', dispensedQty: 30 });
    expect(storedRx().refillsLeft).toBe(2);
    expect(storedRx().consumedBy).toEqual([order.id]);
    expect(shop.carts.get(cart.id)?.cartState).toBe('Ordered');
  });

  it('is idempotent on the order id: a second run answers with the same order and consumes nothing twice', async () => {
    const cart = readyCart();
    const first = await placeOrder(input(cart.id));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = await finalizeOrder(first.orderId, { provider });
    expect(second).toMatchObject({ ok: true, replay: true, orderId: first.orderId, orderNumber: first.orderNumber });
    expect(storedRx().refillsLeft).toBe(2);
  });

  it('two simultaneous runs (callback and lazy read) finish one order with one number and one consumption', async () => {
    const cart = readyCart();
    await prepareCheckout(input(cart.id), provider);
    const order = await checkoutCreatesOrder(shop, cart.id);
    const [a, b] = await Promise.all([finalizeOrder(order.id, { provider, now: MORNING }), finalizeOrder(order.id, { provider, now: MORNING })]);
    expect([a, b].filter((o) => o.ok && !o.replay)).toHaveLength(1);
    expect([a, b].filter((o) => !o.ok).every((o) => !o.ok && o.code === 'IN_PROGRESS')).toBe(true);
    expect(shop.orders[0].orderNumber).toBe('MLV-000001');
    expect(storedRx().refillsLeft).toBe(2);
  });

  it('sets the number only if unset: an order that already has one keeps it and no counter value is used', async () => {
    const cart = readyCart();
    await prepareCheckout(input(cart.id), provider);
    const order = await checkoutCreatesOrder(shop, cart.id);
    shop.orders[0].orderNumber = 'MLV-000777';
    expect(await finalizeOrder(order.id, { provider, now: MORNING })).toMatchObject({ ok: true, orderNumber: 'MLV-000777' });
    expect(objects.objects.some((o) => o.container === CONTAINERS.counter)).toBe(false);
  });

  it('needsFinalize: an order Checkout just created has no number and no state; a finalized one has both', async () => {
    const cart = readyCart();
    const order = await checkoutCreatesOrder(shop, cart.id);
    expect(needsFinalize(shop.orders[0] as unknown as Parameters<typeof needsFinalize>[0])).toBe(true);
    await finalizeOrder(order.id, { provider, now: MORNING });
    expect(needsFinalize(shop.orders[0] as unknown as Parameters<typeof needsFinalize>[0])).toBe(false);
  });

  it('an interrupted consumption leaves the order alone and the next caller finishes it, once', async () => {
    const cart = readyCart();
    await prepareCheckout(input(cart.id), provider);
    const order = await checkoutCreatesOrder(shop, cart.id);
    objects.failOn = (op, container) => (op === 'post' && container === CONTAINERS.rx ? new Error('network') : undefined);
    expect(await finalizeOrder(order.id, { provider, now: MORNING })).toEqual({ ok: false, code: 'PLACEMENT_FAILED' });
    expect(shop.orders).toHaveLength(1);
    expect(shop.orders[0].orderNumber).toBeUndefined();
    expect(storedRx().refillsLeft).toBe(3);

    objects.failOn = undefined;
    expect(await finalizeOrder(order.id, { provider, now: MORNING })).toMatchObject({ ok: true, orderId: order.id });
    expect(shop.orders).toHaveLength(1);
    expect(storedRx().refillsLeft).toBe(2);
  });

  it('the prescription refusing at the last moment cancels the order, gives the card payment back through Checkout and stays refused', async () => {
    const cart = readyCart();
    await prepareCheckout(input(cart.id), provider);
    objects.objects.length = 0;
    storeRx(rx({ refillsLeft: 0 }));
    const order = await checkoutCreatesOrder(shop, cart.id);
    expect(await finalizeOrder(order.id, { provider, now: MORNING })).toEqual({ ok: false, code: 'DISPENSE_REFUSED' });
    expect(shop.orders[0].state?.key).toBe('mlv-cancelled');
    // Authorized, never captured: the authorization is cancelled, nothing is refunded.
    expect(provider.released).toHaveLength(1);
    expect(provider.refunded).toHaveLength(0);
    expect(await finalizeOrder(order.id, { provider, now: MORNING })).toEqual({ ok: false, code: 'DISPENSE_REFUSED' });
    expect(provider.released).toHaveLength(1);
  });

  it('an order that does not exist is NOT_FOUND and leaves no lock behind', async () => {
    expect(await finalizeOrder('order-nope', { provider })).toEqual({ ok: false, code: 'NOT_FOUND' });
    expect(await finalizeOrder('a b/c', { provider })).toEqual({ ok: false, code: 'NOT_FOUND' });
    expect(objects.objects.filter((o) => o.container === CONTAINERS.orderAttempt)).toHaveLength(0);
  });

  it('an order the buyer already cancelled is not consumed', async () => {
    const cart = readyCart();
    const order = await checkoutCreatesOrder(shop, cart.id);
    shop.orders[0].state = { typeId: 'state', key: 'mlv-cancelled', obj: { key: 'mlv-cancelled' } };
    expect(await finalizeOrder(order.id, { provider, now: MORNING })).toMatchObject({ ok: true });
    expect(storedRx().refillsLeft).toBe(3);
  });

  it('two different orders get different numbers from the counter', async () => {
    const a = readyCart();
    const b = readyCart();
    const [first, second] = await Promise.all([placeOrder(input(a.id)), placeOrder(input(b.id))]);
    expect(first.ok && second.ok).toBe(true);
    expect(shop.orders.map((o) => o.orderNumber).sort()).toEqual(['MLV-000001', 'MLV-000002']);
  });
});

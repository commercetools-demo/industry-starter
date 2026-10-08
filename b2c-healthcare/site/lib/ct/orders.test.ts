// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeObjects, type FakeObjects } from '@/test/fake-custom-objects';
import { createFakeShop, type FakeShop } from '@/test/fake-shop';
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

import { CONTAINERS } from '@/lib/ct/custom-objects';
import type { CheckoutContext } from '@/lib/ct/checkout';
import { placeOrder, type PlaceOrderInput } from './orders';

const provider = createFakePaymentProvider();
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
const input = (cartId: string, over: Partial<PlaceOrderInput> = {}): PlaceOrderInput => ({
  ctx: ctx(), cartId, expectedTotal: totalOf(cartId), idempotencyKey: `${cartId}_${shop.carts.get(cartId)?.version}`, ...over,
});
const authorize = (cartId: string, options?: { decline?: boolean }) => provider.authorize({ id: cartId, total: totalOf(cartId) }, options);

beforeEach(() => {
  shop = createFakeShop();
  objects = createFakeObjects();
  provider.reset();
  storeRx(rx());
  rxMocks.validateRxSelection.mockReset().mockResolvedValue({ rxNumber: 'RX-77102', accepted: [selected], refused: [] });
  rxMocks.findOwnPrescription.mockReset().mockImplementation(async () => rx({ refillsLeft: storedRx()?.refillsLeft ?? 3 }));
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('checkout: Checkout: placeOrder (Q-05)', () => {
  it('Success: creates the order from the cart with an MLV- number and state mlv-received, records the line, consumes once, and the cart is Ordered', async () => {
    const cart = readyCart();
    authorize(cart.id);
    const outcome = await placeOrder(input(cart.id), provider);
    expect(outcome).toMatchObject({ ok: true, replay: false, orderNumber: 'MLV-000001' });
    expect(shop.orders).toHaveLength(1);
    const order = shop.orders[0];
    expect(order).toMatchObject({ orderNumber: 'MLV-000001', customerId: 'c-sam', cart: { id: cart.id } });
    expect(order.state?.key).toBe('mlv-received');
    expect(shop.orderCreates[0]).toMatchObject({ cart: { typeId: 'cart', id: cart.id }, orderNumber: 'MLV-000001', state: { typeId: 'state', key: 'mlv-received' } });
    // Totals are the cart's own.
    expect(order.totalPrice.centAmount).toBe(1875);
    // Line custom fields from N-09 are on the cart line, and so on the order line.
    const fields = order.lineItems[0].custom?.fields as Record<string, unknown>;
    expect(fields).toMatchObject({ rxNumber: 'RX-77102', rxLineRef: 'RX-77102-1', dispensedQty: 30 });
    expect(JSON.parse(String(fields.authorizationParams))).toMatchObject({ issuedAt: '2026-09-24', refillsBefore: 3 });
    expect(JSON.parse(String(fields.suppliedLots))).toEqual([]);
    // The prescription was consumed once for this order id.
    expect(storedRx().refillsLeft).toBe(2);
    expect(storedRx().consumedBy).toEqual([order.id]);
    expect(shop.carts.get(cart.id)?.cartState).toBe('Ordered');
  });

  it('Totals moved after authorization: the cart total changed after the payment was authorized, so no order is placed and the stale authorization is released', async () => {
    shop.taxPercent = { NY: 8 };
    const cart = readyCart({ shippingAddress: { ...ADDRESS, state: 'CA' } });
    authorize(cart.id);
    // The address changes (tax moves the total) after the authorization; the buyer saw the new total.
    const stored = shop.carts.get(cart.id)!;
    stored.shippingAddress = { ...ADDRESS };
    stored.taxedPrice = { totalNet: { ...stored.totalPrice }, totalGross: { ...stored.totalPrice, centAmount: 2025 }, totalTax: { ...stored.totalPrice, centAmount: 150 } };
    const outcome = await placeOrder(input(cart.id, { expectedTotal: { centAmount: 2025, currencyCode: 'USD' } }), provider);
    expect(outcome).toEqual({ ok: false, code: 'TOTALS_MOVED' });
    expect(shop.orders).toHaveLength(0);
    expect(shop.carts.get(cart.id)?.cartState).toBe('Active');
    expect(provider.released).toHaveLength(1);
    expect(storedRx().refillsLeft).toBe(3);
  });

  it('mismatch refusal: the cart no longer says the amount the buyer saw, so nothing is created', async () => {
    const cart = readyCart();
    authorize(cart.id);
    const outcome = await placeOrder(input(cart.id, { expectedTotal: { centAmount: 1500, currencyCode: 'USD' } }), provider);
    expect(outcome).toEqual({ ok: false, code: 'TOTALS_MOVED' });
    expect(shop.orders).toHaveLength(0);
    expect(shop.orderCreates).toHaveLength(0);
  });

  it('the total compared is the cart\'s, never anything the browser sends as the amount to charge', async () => {
    const cart = readyCart();
    authorize(cart.id);
    const outcome = await placeOrder(input(cart.id), provider);
    expect(outcome.ok).toBe(true);
    expect(shop.orders[0].totalPrice.centAmount).toBe(shop.carts.get(cart.id)?.totalPrice.centAmount);
  });

  it('Placement fails at the last moment: the cart is kept, the payment released, nothing consumed and the lock freed', async () => {
    const cart = readyCart();
    authorize(cart.id);
    shop.failNextOrder = { statusCode: 400, body: { errors: [{ code: 'InvalidOperation' }] } };
    const outcome = await placeOrder(input(cart.id), provider);
    expect(outcome).toEqual({ ok: false, code: 'PLACEMENT_FAILED' });
    expect(shop.orders).toHaveLength(0);
    const kept = shop.carts.get(cart.id)!;
    expect(kept.cartState).toBe('Active');
    expect(kept.lineItems).toHaveLength(1);
    expect(provider.released).toHaveLength(1);
    expect(storedRx().refillsLeft).toBe(3);
    expect(objects.objects.filter((o) => o.container === CONTAINERS.orderAttempt)).toHaveLength(0);
  });

  it('Placement fails at the last moment: retry creates exactly one order (after paying again)', async () => {
    const cart = readyCart();
    authorize(cart.id);
    shop.failNextOrder = { statusCode: 400, body: { errors: [{ code: 'InvalidOperation' }] } };
    await placeOrder(input(cart.id), provider);
    expect(await placeOrder(input(cart.id), provider)).toEqual({ ok: false, code: 'PAYMENT_REQUIRED' });
    authorize(cart.id);
    const retried = await placeOrder(input(cart.id), provider);
    expect(retried.ok).toBe(true);
    expect(shop.orders).toHaveLength(1);
    expect(storedRx().refillsLeft).toBe(2);
  });

  it('a lost answer is not a failed order: the order that exists is returned and the payment is not released', async () => {
    const cart = readyCart();
    authorize(cart.id);
    shop.loseNextOrderAnswer = true;
    const outcome = await placeOrder(input(cart.id), provider);
    expect(outcome).toMatchObject({ ok: true, replay: true });
    expect(shop.orders).toHaveLength(1);
    expect(provider.released).toHaveLength(0);
  });

  it('retry with the same key returns the same order and consumes nothing twice', async () => {
    const cart = readyCart();
    authorize(cart.id);
    const key = `${cart.id}_1`;
    const first = await placeOrder(input(cart.id, { idempotencyKey: key }), provider);
    const second = await placeOrder(input(cart.id, { idempotencyKey: key }), provider);
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.orderId).toBe(first.orderId);
      expect(second.orderNumber).toBe(first.orderNumber);
      expect(second.replay).toBe(true);
    }
    expect(shop.orders).toHaveLength(1);
    expect(storedRx().refillsLeft).toBe(2);
  });

  it('Double submit: two simultaneous attempts with one key create one order', async () => {
    const cart = readyCart();
    authorize(cart.id);
    const key = `${cart.id}_1`;
    const [a, b] = await Promise.all([placeOrder(input(cart.id, { idempotencyKey: key }), provider), placeOrder(input(cart.id, { idempotencyKey: key }), provider)]);
    expect(shop.orders).toHaveLength(1);
    expect([a, b].filter((o) => o.ok && !o.replay)).toHaveLength(1);
    expect([a, b].filter((o) => !o.ok).every((o) => !o.ok && o.code === 'IN_PROGRESS')).toBe(true);
    expect(storedRx().refillsLeft).toBe(2);
  });

  it('a different key for the same, already ordered cart still returns the existing order', async () => {
    const cart = readyCart();
    authorize(cart.id);
    const first = await placeOrder(input(cart.id, { idempotencyKey: 'key-one' }), provider);
    const again = await placeOrder(input(cart.id, { idempotencyKey: 'key-two' }), provider);
    expect(first.ok && again.ok).toBe(true);
    if (first.ok && again.ok) expect(again.orderId).toBe(first.orderId);
    expect(shop.orders).toHaveLength(1);
  });

  it('payment: no authorization -> PAYMENT_REQUIRED, declined -> PAYMENT_DECLINED, and no order either way', async () => {
    const cart = readyCart();
    expect(await placeOrder(input(cart.id), provider)).toEqual({ ok: false, code: 'PAYMENT_REQUIRED' });
    authorize(cart.id, { decline: true });
    expect(await placeOrder(input(cart.id), provider)).toEqual({ ok: false, code: 'PAYMENT_DECLINED' });
    expect(shop.orders).toHaveLength(0);
    expect(shop.carts.get(cart.id)?.cartState).toBe('Active');
  });

  it('re-validates the lines: a line that can no longer be filled blocks the order and names the line', async () => {
    const cart = readyCart();
    authorize(cart.id);
    rxMocks.validateRxSelection.mockResolvedValue({
      rxNumber: 'RX-77102', accepted: [],
      refused: [{ lineRef: 'RX-77102-1', name: '', sig: '', qty: 30, price: null, status: 'NO_REFILLS', selectable: false, remaining: 0, minShelfLifeMonths: null }],
    });
    const outcome = await placeOrder(input(cart.id), provider);
    expect(outcome).toEqual({ ok: false, code: 'LINES_UNAVAILABLE', lineIds: [shop.carts.get(cart.id)!.lineItems[0].id] });
    expect(shop.orders).toHaveLength(0);
  });

  it('a prescription that can no longer be found blocks the order too', async () => {
    const cart = readyCart();
    authorize(cart.id);
    rxMocks.validateRxSelection.mockRejectedValue(new rxMocks.RxNotFoundError());
    expect((await placeOrder(input(cart.id), provider)).ok).toBe(false);
    expect(shop.orders).toHaveLength(0);
  });

  it('same-day chosen before 14:00 but placed after the cut-off is refused (D-033)', async () => {
    const cart = readyCart({ methodKey: 'mlv-same-day' });
    authorize(cart.id);
    expect(await placeOrder(input(cart.id, { ctx: ctx(AFTERNOON) }), provider)).toEqual({ ok: false, code: 'NO_DELIVERY_METHOD' });
    const morning = await placeOrder(input(cart.id, { ctx: ctx(MORNING) }), provider);
    expect(morning).toMatchObject({ ok: true });
  });

  it('refuses without an address, and never places another customer\'s cart', async () => {
    const bare = shop.seedCart();
    authorize(bare.id);
    expect(await placeOrder(input(bare.id), provider)).toEqual({ ok: false, code: 'ADDRESS_MISSING' });
    const other = readyCart({ customerId: 'c-other' });
    authorize(other.id);
    expect(await placeOrder(input(other.id), provider)).toEqual({ ok: false, code: 'EMPTY_CART' });
    expect(shop.orders).toHaveLength(0);
  });

  it('an empty or missing cart is EMPTY_CART', async () => {
    const empty = readyCart({ lines: [] });
    expect(await placeOrder(input(empty.id), provider)).toEqual({ ok: false, code: 'EMPTY_CART' });
    expect(await placeOrder({ ctx: ctx(), cartId: 'cart-nope', expectedTotal: { centAmount: 1, currencyCode: 'USD' }, idempotencyKey: 'k-nope' }, provider)).toEqual({ ok: false, code: 'EMPTY_CART' });
  });

  it('a malformed idempotency key is refused before anything is read', async () => {
    const cart = readyCart();
    authorize(cart.id);
    expect(await placeOrder(input(cart.id, { idempotencyKey: 'a b/c' }), provider)).toEqual({ ok: false, code: 'PLACEMENT_FAILED' });
    expect(shop.matchingCalls).toHaveLength(0);
  });

  it('the prescription refusing at the last moment cancels the order, releases the payment and stays refused on retry', async () => {
    const cart = readyCart();
    authorize(cart.id);
    objects.objects.length = 0;
    storeRx(rx({ refillsLeft: 0 }));
    const key = `${cart.id}_1`;
    const outcome = await placeOrder(input(cart.id, { idempotencyKey: key }), provider);
    expect(outcome).toEqual({ ok: false, code: 'DISPENSE_REFUSED' });
    expect(shop.orders).toHaveLength(1);
    expect(shop.orders[0].state?.key).toBe('mlv-cancelled');
    expect(provider.released).toHaveLength(1);
    expect(await placeOrder(input(cart.id, { idempotencyKey: key }), provider)).toEqual({ ok: false, code: 'DISPENSE_REFUSED' });
    expect(shop.orders).toHaveLength(1);
  });

  it('an interrupted consumption leaves the order in place and the same key finishes it without a second order', async () => {
    const cart = readyCart();
    authorize(cart.id);
    const key = `${cart.id}_1`;
    objects.failOn = (op, container) => (op === 'post' && container === CONTAINERS.rx ? new Error('network') : undefined);
    expect(await placeOrder(input(cart.id, { idempotencyKey: key }), provider)).toEqual({ ok: false, code: 'IN_PROGRESS' });
    expect(shop.orders).toHaveLength(1);
    expect(storedRx().refillsLeft).toBe(3);

    objects.failOn = undefined;
    const resumed = await placeOrder(input(cart.id, { idempotencyKey: key }), provider);
    expect(resumed).toMatchObject({ ok: true, orderId: shop.orders[0].id });
    expect(shop.orders).toHaveLength(1);
    expect(storedRx().refillsLeft).toBe(2);
  });

  it('two different orders get different numbers from the counter', async () => {
    const a = readyCart();
    authorize(a.id);
    const b = readyCart();
    authorize(b.id);
    const [first, second] = await Promise.all([placeOrder(input(a.id), provider), placeOrder(input(b.id), provider)]);
    expect(first.ok && second.ok).toBe(true);
    const numbers = shop.orders.map((o) => o.orderNumber).sort();
    expect(numbers).toEqual(['MLV-000001', 'MLV-000002']);
  });
});

// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectUnauthenticated } from '@/test/api';
import { checkoutCreatesOrder } from '@/test/checkout-flow';
import { createFakeObjects, type FakeObjects } from '@/test/fake-custom-objects';
import { createFakeShop, type FakeShop } from '@/test/fake-shop';
import { makeJsonRequest } from '@/test/request';
import { createFakePaymentProvider } from '@/lib/checkout/fake-provider';
import { PaymentUnavailableError } from '@/lib/checkout/payment-provider';
import type { Prescription } from '@/lib/clinical/types';

let shop: FakeShop;
let objects: FakeObjects;
vi.mock('@/lib/ct/client', () => ({
  apiRoot: new Proxy({}, { get: (_t, p) => (p === 'customObjects' ? objects.customObjects : (shop.apiRoot as Record<string, unknown>)[p as string]) }),
}));
const session = vi.hoisted(() => ({ getSession: vi.fn(), setCart: vi.fn(), clearCart: vi.fn() }));
vi.mock('@/lib/session', () => session);
vi.mock('@/lib/ct/patient', () => ({ getPatient: async () => ({ patientRef: 'pt_sam', name: 'Sam Rivera' }) }));
vi.mock('@/lib/ct/rx-catalog', () => ({ getCatalogBySku: async () => new Map() }));
const rxMocks = vi.hoisted(() => ({ validateRxSelection: vi.fn(), findOwnPrescription: vi.fn(), RxNotFoundError: class extends Error {} }));
vi.mock('@/lib/ct/prescriptions', () => rxMocks);
const providerMock = vi.hoisted(() => ({ getPaymentProvider: vi.fn() }));
vi.mock('@/lib/checkout/provider', () => providerMock);

import { CONTAINERS } from '@/lib/ct/custom-objects';
import { POST as prepare } from './prepare/route';
import { POST as complete } from './complete/route';

const demo = createFakePaymentProvider();
const ADDRESS = { country: 'US', state: 'NY', streetName: '12 Elm St', city: 'New York', postalCode: '10001', firstName: 'Sam', lastName: 'Rivera', phone: '+15125550100' };
const rx = (): Prescription => ({ number: 'RX-77102', patientRef: 'pt_sam', prescriber: 'Dr. Test', issuedAt: '2026-09-24', refillsLeft: 3, lines: [{ lineRef: 'RX-77102-1', sku: 'MED-ator', name: 'A', sig: 'sig', qty: 30 }] });
const selected = { lineRef: 'RX-77102-1', sku: 'MED-ator', qty: 30, packs: 1, price: null, perOrderMax: null, periodCeiling: null };
const signedIn = (cartId?: string, customerId = 'c-sam') => session.getSession.mockResolvedValue({ customerId, locale: 'en-US', currency: 'USD', country: 'US', ...(cartId ? { cartId } : {}) });
const body = (centAmount = 1875) => ({ expectedTotal: { centAmount, currencyCode: 'USD' } });
const callPrepare = (b: unknown) => prepare(makeJsonRequest('/api/checkout/prepare', b));
const callComplete = (b: unknown) => complete(makeJsonRequest('/api/checkout/complete', b));

beforeEach(() => {
  shop = createFakeShop();
  objects = createFakeObjects();
  demo.reset();
  session.getSession.mockReset();
  session.clearCart.mockReset().mockResolvedValue({});
  objects.objects.push({ id: 'o-rx', container: CONTAINERS.rx, key: 'RX-77102', version: 1, value: rx(), createdAt: '', lastModifiedAt: '' });
  rxMocks.validateRxSelection.mockReset().mockResolvedValue({ rxNumber: 'RX-77102', accepted: [selected], refused: [] });
  rxMocks.findOwnPrescription.mockReset().mockImplementation(async () => rx());
  providerMock.getPaymentProvider.mockReset().mockResolvedValue(demo);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  // requirePatient reads the patient through the clinical store in the real route; the route helper is mocked below via the patient mock.
});

describe('checkout: POST /api/checkout/prepare (AA)', () => {
  it('signed out: 401 and nothing is read', async () => {
    session.getSession.mockResolvedValue({});
    await expectUnauthenticated(prepare, [], makeJsonRequest('/api/checkout/prepare', body()));
  });

  it('rejects a body without a valid expected total', async () => {
    const cart = shop.seedCart({ shippingAddress: ADDRESS });
    signedIn(cart.id);
    expect((await callPrepare({})).status).toBe(400);
    expect((await callPrepare({ expectedTotal: { centAmount: 'x', currencyCode: 'USD' } })).status).toBe(400);
    expect((await callPrepare({ expectedTotal: { centAmount: 1, currencyCode: 'usd' } })).status).toBe(400);
  });

  it('a cart that passes answers what to mount and creates no order', async () => {
    const cart = shop.seedCart({ shippingAddress: ADDRESS });
    signedIn(cart.id);
    const response = await callPrepare(body());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ kind: 'demo', cardDue: 1875 });
    expect(shop.orders).toHaveLength(0);
    expect(session.clearCart).not.toHaveBeenCalled();
  });

  it('a refusal answers the code with the cart kept: totals moved is 409, an unfillable line is 422 and names the line', async () => {
    const cart = shop.seedCart({ shippingAddress: ADDRESS });
    signedIn(cart.id);
    const moved = await callPrepare(body(1500));
    expect(moved.status).toBe(409);
    expect(await moved.json()).toMatchObject({ code: 'TOTALS_MOVED' });
    rxMocks.validateRxSelection.mockResolvedValue({ rxNumber: 'RX-77102', accepted: [], refused: [{ lineRef: 'RX-77102-1', name: '', sig: '', qty: 30, price: null, status: 'NO_REFILLS', selectable: false, remaining: 0, minShelfLifeMonths: null }] });
    const bad = await callPrepare(body());
    expect(bad.status).toBe(422);
    expect(await bad.json()).toMatchObject({ code: 'LINES_UNAVAILABLE', lineIds: [shop.carts.get(cart.id)!.lineItems[0].id] });
    expect(shop.carts.get(cart.id)?.cartState).toBe('Active');
  });

  it('payment not configured: 503 with a safe message', async () => {
    const cart = shop.seedCart({ shippingAddress: ADDRESS });
    signedIn(cart.id);
    providerMock.getPaymentProvider.mockRejectedValue(new PaymentUnavailableError());
    const response = await callPrepare(body());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Payment is not available right now.' });
  });
});

describe('checkout: POST /api/checkout/complete, the browser callback (AA)', () => {
  it('signed out: 401', async () => {
    session.getSession.mockResolvedValue({});
    await expectUnauthenticated(complete, [], makeJsonRequest('/api/checkout/complete', { orderId: 'order-1' }));
  });

  it('finalizes the order Checkout created, answers its number and clears the session cart', async () => {
    const cart = shop.seedCart({ shippingAddress: ADDRESS });
    signedIn(cart.id);
    await callPrepare(body());
    const order = await checkoutCreatesOrder(shop, cart.id);
    const response = await callComplete({ orderId: order.id });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ orderId: order.id, orderNumber: 'MLV-000001' });
    expect(session.clearCart).toHaveBeenCalled();
    expect(shop.orders[0].state?.key).toBe('mlv-received');
  });

  it('is safe to call twice (a double callback, or the lazy read got there first): same order, one consumption', async () => {
    const cart = shop.seedCart({ shippingAddress: ADDRESS });
    signedIn(cart.id);
    await callPrepare(body());
    const order = await checkoutCreatesOrder(shop, cart.id);
    const [a, b] = await Promise.all([callComplete({ orderId: order.id }), callComplete({ orderId: order.id })]);
    const again = await callComplete({ orderId: order.id });
    expect(again.status).toBe(200);
    expect([a.status, b.status].filter((s) => s === 200).length).toBeGreaterThanOrEqual(1);
    expect(shop.orders[0].orderNumber).toBe('MLV-000001');
    expect((objects.objects.find((o) => o.container === CONTAINERS.rx)!.value as Prescription).refillsLeft).toBe(2);
  });

  it('another customer\'s order and an unknown id are the same 404, and nothing is finalized', async () => {
    const cart = shop.seedCart({ shippingAddress: ADDRESS });
    const order = await checkoutCreatesOrder(shop, cart.id);
    signedIn(undefined, 'c-alex');
    const foreign = await callComplete({ orderId: order.id });
    const unknown = await callComplete({ orderId: 'order-nope' });
    expect(foreign.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(await foreign.json()).toEqual(await unknown.json());
    expect(shop.orders[0].orderNumber).toBeUndefined();
  });

  it('rejects a body without a usable order id', async () => {
    signedIn();
    expect((await callComplete({})).status).toBe(400);
    expect((await callComplete({ orderId: 'a b/c' })).status).toBe(400);
  });

  it('the prescription refusing at the last moment answers 422 DISPENSE_REFUSED; the order is cancelled and the cart is not cleared', async () => {
    const cart = shop.seedCart({ shippingAddress: ADDRESS });
    signedIn(cart.id);
    await callPrepare(body());
    objects.objects.length = 0;
    objects.objects.push({ id: 'o-rx', container: CONTAINERS.rx, key: 'RX-77102', version: 1, value: { ...rx(), refillsLeft: 0 }, createdAt: '', lastModifiedAt: '' });
    const order = await checkoutCreatesOrder(shop, cart.id);
    const response = await callComplete({ orderId: order.id });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'DISPENSE_REFUSED' });
    expect(shop.orders[0].state?.key).toBe('mlv-cancelled');
    expect(session.clearCart).not.toHaveBeenCalled();
  });
});

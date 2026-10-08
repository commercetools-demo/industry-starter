// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectUnauthenticated } from '@/test/api';
import { makeJsonRequest } from '@/test/request';
import { PaymentUnavailableError } from '@/lib/checkout/payment-provider';

const session = vi.hoisted(() => ({ getSession: vi.fn(), setCart: vi.fn(), clearCart: vi.fn() }));
vi.mock('@/lib/session', () => session);
const getPatient = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ct/patient', () => ({ getPatient: (id: string) => getPatient(id) }));
vi.mock('@/lib/ct/prescriptions', () => ({ RxNotFoundError: class extends Error {}, validateRxSelection: vi.fn() }));
const orders = vi.hoisted(() => ({ placeOrder: vi.fn() }));
vi.mock('@/lib/ct/orders', () => orders);
const providerMock = vi.hoisted(() => ({ getPaymentProvider: vi.fn() }));
vi.mock('@/lib/checkout/provider', () => providerMock);
const checkoutMock = vi.hoisted(() => ({ readPaymentCart: vi.fn() }));
vi.mock('@/lib/ct/checkout', () => checkoutMock);

import { POST } from './place/route';

const body = (over: Record<string, unknown> = {}) => ({ expectedTotal: { centAmount: 1875, currencyCode: 'USD' }, cartVersion: 3, ...over });
const post = (b: unknown) => POST(makeJsonRequest('/api/checkout/place', b));
const signedIn = (cartId: string | null = 'cart-1') => session.getSession.mockResolvedValue({ customerId: 'c-sam', locale: 'en-US', currency: 'USD', country: 'US', ...(cartId ? { cartId } : {}) });

beforeEach(() => {
  session.getSession.mockReset();
  session.clearCart.mockReset().mockResolvedValue({});
  getPatient.mockReset().mockResolvedValue({ patientRef: 'pt_sam', name: 'Sam Rivera' });
  const provider = { kind: 'demo' };
  providerMock.getPaymentProvider.mockReset().mockResolvedValue(provider);
  orders.placeOrder.mockReset().mockResolvedValue({ ok: true, replay: false, orderId: 'order-1', orderNumber: 'MLV-000001' });
  checkoutMock.readPaymentCart.mockReset().mockResolvedValue({ id: 'cart-from-customer' });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('design-checkout: Place order: POST /api/checkout/place (Q-06)', () => {
  it('Success: answers the order id and number, empties the session cart, never caches', async () => {
    signedIn();
    const response = await post(body());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ orderId: 'order-1', orderNumber: 'MLV-000001' });
    expect(session.clearCart).toHaveBeenCalledTimes(1);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('Double submit: the idempotency key is the session cart id plus the cart version, so a repeat is the same attempt', async () => {
    signedIn('cart-9');
    await post(body({ cartVersion: 7 }));
    await post(body({ cartVersion: 7 }));
    const keys = orders.placeOrder.mock.calls.map((c) => (c[0] as { idempotencyKey: string }).idempotencyKey);
    expect(keys).toEqual(['cart-9_7', 'cart-9_7']);
    expect(orders.placeOrder.mock.calls[0][0]).toMatchObject({ cartId: 'cart-9', expectedTotal: { centAmount: 1875, currencyCode: 'USD' } });
  });

  it('uses the customer\'s cart when the session has none', async () => {
    signedIn(null);
    await post(body());
    expect(orders.placeOrder.mock.calls[0][0]).toMatchObject({ cartId: 'cart-from-customer' });
  });

  it('no cart at all: 422 EMPTY_CART, nothing placed', async () => {
    signedIn(null);
    checkoutMock.readPaymentCart.mockResolvedValue(null);
    const response = await post(body());
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe('EMPTY_CART');
    expect(orders.placeOrder).not.toHaveBeenCalled();
  });

  it.each([
    ['TOTALS_MOVED', 409],
    ['IN_PROGRESS', 409],
    ['PAYMENT_REQUIRED', 422],
    ['PAYMENT_DECLINED', 422],
    ['LINES_UNAVAILABLE', 422],
    ['DISPENSE_REFUSED', 422],
    ['PLACEMENT_FAILED', 502],
  ])('Declined payment and other refusals: %s answers %i with a code, keeps the cart', async (code, status) => {
    signedIn();
    orders.placeOrder.mockResolvedValue({ ok: false, code });
    const response = await post(body());
    expect(response.status).toBe(status);
    const json = await response.json();
    expect(json.code).toBe(code);
    expect(typeof json.error).toBe('string');
    expect(session.clearCart).not.toHaveBeenCalled();
  });

  it('names the lines that cannot be filled', async () => {
    signedIn();
    orders.placeOrder.mockResolvedValue({ ok: false, code: 'LINES_UNAVAILABLE', lineIds: ['li-1'] });
    expect((await (await post(body())).json()).lineIds).toEqual(['li-1']);
  });

  it.each([
    {},
    { expectedTotal: { centAmount: 1.5, currencyCode: 'USD' }, cartVersion: 1 },
    { expectedTotal: { centAmount: 100, currencyCode: 'usd' }, cartVersion: 1 },
    { expectedTotal: { centAmount: 100, currencyCode: 'USD' }, cartVersion: -1 },
    { expectedTotal: { centAmount: '100', currencyCode: 'USD' }, cartVersion: 1 },
    { expectedTotal: { centAmount: 100, currencyCode: 'USD' } },
  ])('400 for a malformed body %j, before anything is placed', async (b) => {
    signedIn();
    expect((await post(b)).status).toBe(400);
    expect(orders.placeOrder).not.toHaveBeenCalled();
  });

  it('503 with a safe message when payment is not configured', async () => {
    signedIn();
    providerMock.getPaymentProvider.mockRejectedValue(new PaymentUnavailableError());
    const response = await post(body());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Payment is not available right now.' });
  });

  it('never leaks an unexpected error', async () => {
    signedIn();
    orders.placeOrder.mockRejectedValue(Object.assign(new Error('secret-token RX-77102'), { statusCode: 500 }));
    const text = await (await post(body())).text();
    expect(text).not.toContain('secret-token');
    expect(text).not.toContain('RX-77102');
  });

  it('401 without a customer, before anything else', async () => {
    session.getSession.mockResolvedValue({});
    await expectUnauthenticated(POST, [getPatient, orders.placeOrder], makeJsonRequest('/api/checkout/place', body()));
  });
});

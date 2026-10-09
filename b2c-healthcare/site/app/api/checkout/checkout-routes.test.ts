// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectSanitizedError, expectUnauthenticated } from '@/test/api';
import { createFakeShop, type FakeShop } from '@/test/fake-shop';
import { makeJsonRequest } from '@/test/request';

let shop: FakeShop;
vi.mock('@/lib/ct/client', () => ({ apiRoot: new Proxy({}, { get: (_t, p) => (shop.apiRoot as Record<string, unknown>)[p as string] }) }));

const session = vi.hoisted(() => ({ getSession: vi.fn(), setCart: vi.fn(), clearCart: vi.fn() }));
vi.mock('@/lib/session', () => session);

const { RxNotFoundError, validateRxSelection, getPatient } = vi.hoisted(() => ({ RxNotFoundError: class extends Error {}, validateRxSelection: vi.fn(), getPatient: vi.fn() }));
vi.mock('@/lib/ct/prescriptions', () => ({ RxNotFoundError, validateRxSelection: (...a: unknown[]) => validateRxSelection(...a) }));
vi.mock('@/lib/ct/patient', () => ({ getPatient: (id: string) => getPatient(id) }));

import { GET } from './route';
import { PUT as putAddress } from './address/route';
import { PUT as putMethod } from './shipping-method/route';

const validAddress = { firstName: 'Sam', lastName: 'Rivera', street: '12 Elm St', street2: '', city: 'New York', state: 'NY', zip: '10001', phone: '5125550100' };
const signedIn = (cartId?: string) => session.getSession.mockResolvedValue({ customerId: 'c-sam', locale: 'en-US', currency: 'USD', country: 'US', ...(cartId ? { cartId } : {}) });
const put = (handler: typeof putAddress, path: string, body: unknown) => handler(makeJsonRequest(path, body, { method: 'PUT' }));

beforeEach(() => {
  shop = createFakeShop();
  session.getSession.mockReset();
  session.setCart.mockReset().mockResolvedValue({});
  session.clearCart.mockReset().mockResolvedValue({});
  getPatient.mockReset().mockResolvedValue({ patientRef: 'pt_sam', name: 'Sam Rivera' });
  validateRxSelection.mockReset().mockResolvedValue({ rxNumber: 'RX-77102', accepted: [], refused: [] });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  // Before the 14:00 New York cut-off unless a test says otherwise.
  vi.stubEnv('SAME_DAY_NOW_OVERRIDE', '2026-10-08T09:00:00-04:00');
});

afterEach(() => vi.unstubAllEnvs());

describe('checkout-page: PUT /api/checkout/address', () => {
  it('sets the address, answers with the re-read cart and takes the total from it', async () => {
    shop.taxPercent = { NY: 8 };
    const cart = shop.seedCart();
    signedIn(cart.id);
    const response = await put(putAddress, '/api/checkout/address', validAddress);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json();
    expect(body.cart.total.centAmount).toBe(2025);
    expect(body.cart.tax.centAmount).toBe(150);
    expect(body.options.map((o: { key: string }) => o.key)).toEqual(['mlv-standard', 'mlv-same-day']);
    // The phone was normalized by the shared validator before it reached the cart.
    expect(shop.updates[0].actions[0]).toMatchObject({ action: 'setShippingAddress', address: { phone: '+15125550100', state: 'NY', country: 'US' } });
  });

  it('No delivery method for address: 422 NO_DELIVERY_METHOD with the state, so the page can say what to change', async () => {
    shop.unserved.add('AK');
    const cart = shop.seedCart();
    signedIn(cart.id);
    const response = await put(putAddress, '/api/checkout/address', { ...validAddress, state: 'AK', zip: '99501' });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body).toMatchObject({ code: 'NO_DELIVERY_METHOD', state: { deliverable: false, options: [] } });
  });

  it('400 with the fields for a malformed address, before any commercetools call', async () => {
    const cart = shop.seedCart();
    signedIn(cart.id);
    const response = await put(putAddress, '/api/checkout/address', { ...validAddress, zip: '123', phone: 'abc' });
    expect(response.status).toBe(400);
    expect((await response.json()).fields).toMatchObject({ zip: 'invalid', phone: 'invalid' });
    expect(shop.updates).toHaveLength(0);
  });

  it('401 without a customer, 403 without a patient record, 404 without a cart', async () => {
    session.getSession.mockResolvedValue({});
    await expectUnauthenticated(putAddress, [getPatient], makeJsonRequest('/api/checkout/address', validAddress, { method: 'PUT' }));
    signedIn();
    getPatient.mockResolvedValue(null);
    expect((await put(putAddress, '/api/checkout/address', validAddress)).status).toBe(403);
    getPatient.mockResolvedValue({ patientRef: 'pt_sam', name: 'Sam Rivera' });
    expect((await put(putAddress, '/api/checkout/address', validAddress)).status).toBe(404);
  });

  it('never leaks a commercetools error body', async () => {
    const cart = shop.seedCart();
    signedIn(cart.id);
    const original = shop.apiRoot as { carts: () => unknown };
    shop.apiRoot = { ...original, carts: () => { throw Object.assign(new Error('secret-token-123 RX-77102'), { statusCode: 500 }); } };
    await expectSanitizedError(putAddress, ['secret-token-123', 'RX-77102'], makeJsonRequest('/api/checkout/address', validAddress, { method: 'PUT' }));
  });
});

describe('checkout-page: PUT /api/checkout/shipping-method', () => {
  it('Change: same-day in a same-day state: the summary comes from the recalculated cart', async () => {
    const cart = shop.seedCart({ shippingAddress: { country: 'US', state: 'TX', city: 'Austin', postalCode: '78701', streetName: 'x', firstName: 'a', lastName: 'b', phone: '+15125550100' } });
    signedIn(cart.id);
    const response = await put(putMethod, '/api/checkout/shipping-method', { key: 'mlv-same-day' });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.cart.shipping.price.centAmount).toBe(500);
    expect(body.cart.total.centAmount).toBe(2375);
  });

  it('Same-day not available: 422 METHOD_UNAVAILABLE after the cut-off and the cart is not changed', async () => {
    const cart = shop.seedCart({ shippingAddress: { country: 'US', state: 'TX' } });
    signedIn(cart.id);
    vi.stubEnv('SAME_DAY_NOW_OVERRIDE', '2026-10-08T15:00:00-04:00');
    const response = await put(putMethod, '/api/checkout/shipping-method', { key: 'mlv-same-day' });
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe('METHOD_UNAVAILABLE');
    expect(shop.updates).toHaveLength(0);
  });

  it.each([{}, { key: 5 }, { key: '' }, { key: 'a/b' }])('400 for a malformed body %j', async (body) => {
    const cart = shop.seedCart();
    signedIn(cart.id);
    expect((await put(putMethod, '/api/checkout/shipping-method', body)).status).toBe(400);
  });

  it('401 without a customer', async () => {
    session.getSession.mockResolvedValue({});
    await expectUnauthenticated(putMethod, [getPatient], makeJsonRequest('/api/checkout/shipping-method', { key: 'mlv-standard' }, { method: 'PUT' }));
  });
});

describe('checkout-page: GET /api/checkout', () => {
  it('returns the checkout state, sets the session cart and is never cached', async () => {
    const cart = shop.seedCart();
    signedIn();
    // The session has no cartId: the customer's newest Active cart is found.
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json();
    expect(body.cart.id).toBe(cart.id);
    expect(session.setCart).toHaveBeenCalledWith(cart.id);
    expect(body.paymentMode).toBe('psp');
  });

  it('null for a customer without a cart', async () => {
    signedIn();
    const response = await GET();
    expect(await response.json()).toBeNull();
  });

  it('401 without a customer', async () => {
    session.getSession.mockResolvedValue({});
    await expectUnauthenticated(GET as never, [getPatient]);
  });
});

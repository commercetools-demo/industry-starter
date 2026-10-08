// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectUnauthenticated } from '@/test/api';
import { createFakeShop, type FakeShop } from '@/test/fake-shop';
import { makeJsonRequest } from '@/test/request';
import { PaymentUnavailableError } from '@/lib/checkout/payment-provider';
import { createFakePaymentProvider } from '@/lib/checkout/fake-provider';

let shop: FakeShop;
vi.mock('@/lib/ct/client', () => ({ apiRoot: new Proxy({}, { get: (_t, p) => (shop.apiRoot as Record<string, unknown>)[p as string] }) }));

const session = vi.hoisted(() => ({ getSession: vi.fn(), setCart: vi.fn(), clearCart: vi.fn() }));
vi.mock('@/lib/session', () => session);

const getPatient = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ct/patient', () => ({ getPatient: (id: string) => getPatient(id) }));
vi.mock('@/lib/ct/prescriptions', () => ({ RxNotFoundError: class extends Error {}, validateRxSelection: vi.fn() }));

const providerMock = vi.hoisted(() => ({ getPaymentProvider: vi.fn() }));
vi.mock('@/lib/checkout/provider', () => providerMock);

import { POST } from './session/route';
import { POST as demoAuthorize } from './demo-authorize/route';

const demo = createFakePaymentProvider();
const signedIn = (cartId?: string) => session.getSession.mockResolvedValue({ customerId: 'c-sam', locale: 'en-US', currency: 'USD', country: 'US', ...(cartId ? { cartId } : {}) });
const readyCart = () => shop.seedCart({ shippingAddress: { country: 'US', state: 'NY', streetName: '12 Elm St', city: 'New York', postalCode: '10001', firstName: 'Sam', lastName: 'Rivera', phone: '+15125550100' } });

beforeEach(() => {
  shop = createFakeShop();
  demo.reset();
  session.getSession.mockReset();
  getPatient.mockReset().mockResolvedValue({ patientRef: 'pt_sam', name: 'Sam Rivera' });
  providerMock.getPaymentProvider.mockReset().mockResolvedValue(demo);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe('design-checkout: Payment through the payment widget: session (Q-04)', () => {
  it('creates a session for the cart with the cart total, never an amount from the request', async () => {
    shop.taxPercent = { NY: 8 };
    const cart = readyCart();
    signedIn(cart.id);
    const create = vi.spyOn(demo, 'createSession');
    const response = await POST();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sessionId: `demo-session-${cart.id}`, projectKey: 'demo', region: 'demo', paymentMode: 'demo' });
    // 1875 + 8% tax = 2025: the cart's own gross total.
    expect(create).toHaveBeenCalledWith({ id: cart.id, total: { centAmount: 2025, currencyCode: 'USD', fractionDigits: 2 } });
  });

  it('422 ADDRESS_MISSING until the cart has an address (country alone is not one)', async () => {
    const cart = shop.seedCart();
    signedIn(cart.id);
    const response = await POST();
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe('ADDRESS_MISSING');
  });

  it('404 without a cart or with an empty cart', async () => {
    signedIn();
    expect((await POST()).status).toBe(404);
    const empty = shop.seedCart({ lines: [] });
    signedIn(empty.id);
    expect((await POST()).status).toBe(404);
  });

  it('503 with a safe message when payment is not configured (OA-04) or unreachable', async () => {
    const cart = readyCart();
    signedIn(cart.id);
    providerMock.getPaymentProvider.mockRejectedValue(new PaymentUnavailableError());
    const response = await POST();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Payment is not available right now.' });
  });

  it('401 without a customer, before any commercetools call', async () => {
    session.getSession.mockResolvedValue({});
    await expectUnauthenticated(POST as never, [getPatient, providerMock.getPaymentProvider]);
  });
});

describe('design-checkout: demo-authorize exists only with the fake provider (Q-04)', () => {
  it('is a plain 404 outside MALVA_FIXTURES=1 (the real payment path has no such door)', async () => {
    const cart = readyCart();
    signedIn(cart.id);
    vi.stubEnv('MALVA_FIXTURES', '');
    expect((await demoAuthorize(makeJsonRequest('/api/checkout/demo-authorize', {}))).status).toBe(404);
  });

  it('is a 404 in production even when the switch is set', async () => {
    const cart = readyCart();
    signedIn(cart.id);
    vi.stubEnv('MALVA_FIXTURES', '1');
    vi.stubEnv('NODE_ENV', 'production');
    expect((await demoAuthorize(makeJsonRequest('/api/checkout/demo-authorize', {}))).status).toBe(404);
  });
});

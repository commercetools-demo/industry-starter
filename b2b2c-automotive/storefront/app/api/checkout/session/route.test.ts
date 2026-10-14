// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/lib/types';

const state = vi.hoisted(() => ({ session: {} as Session }));
const prepare = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn());
const email = vi.hoisted(() => vi.fn());
vi.mock('@/lib/session', () => ({ getSession: async () => state.session }));
vi.mock('@/lib/vehicles/active', () => ({ getActiveVehicle: async () => ({ label: '2016 Volkswagen Golf · 2.0 TDI' }) }));
vi.mock('@/lib/ct/checkout-customer', () => ({ getCheckoutCustomerEmail: email }));
vi.mock('@/lib/checkout/session', async () => {
  const actual = await vi.importActual<typeof import('@/lib/checkout/session')>('@/lib/checkout/session');
  return { ...actual, createCheckoutSession: create };
});
vi.mock('@/lib/ct/checkout-prepare', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ct/checkout-prepare')>('@/lib/ct/checkout-prepare');
  return { ...actual, prepareCartForCheckout: prepare };
});

import { EmptyCart, LinesUnavailable, SubscriptionsUnavailable } from '@/lib/ct/checkout-prepare';
import { CheckoutMisconfigured, CheckoutUnavailable } from '@/lib/checkout/session';
import { POST } from './route';

// The handler takes no arguments on purpose: nothing from the request is read (cart and store come from the session).
const post = (...ignoredBody: unknown[]) => {
  void ignoredBody;
  return POST();
};

beforeEach(() => {
  vi.stubEnv('CTP_CHECKOUT_APP_KEY', 'malva-app');
  state.session = { storeKey: 'mau-reseller-north', cartId: 'cart-1', branchKey: 'mau-br-north-berlin' };
  for (const m of [prepare, create, email]) m.mockReset();
  prepare.mockResolvedValue({});
  create.mockResolvedValue({ sessionId: 'sess-1', projectKey: 'test-project', region: 'europe-west1.gcp' });
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/checkout/session', () => {
  it('returns the session id, project key and region', async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sessionId: 'sess-1', projectKey: 'test-project', region: 'europe-west1.gcp' });
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });
  it('cart id comes from the session not the body', async () => {
    await post({ cartId: 'attacker-cart', storeKey: 'other-store' });
    expect(prepare.mock.calls[0][0]).toMatchObject({ cartId: 'cart-1', storeKey: 'mau-reseller-north', branchKey: 'mau-br-north-berlin', vehicleLabel: '2016 Volkswagen Golf · 2.0 TDI' });
    expect(create).toHaveBeenCalledWith({ cartId: 'cart-1', applicationKey: 'malva-app' });
  });
  it('a signed-in customer gets the email prefilled', async () => {
    state.session = { ...state.session, customerId: 'c-1' };
    email.mockResolvedValue('qa-1@example.com');
    await post();
    expect(prepare.mock.calls[0][0].customerEmail).toBe('qa-1@example.com');
  });
  it('409 without a cart in the session', async () => {
    state.session = { storeKey: 'mau-reseller-north' };
    const res = await post();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'cart-missing' });
    expect(prepare).not.toHaveBeenCalled();
  });
  it('503 without an application key', async () => {
    vi.stubEnv('CTP_CHECKOUT_APP_KEY', '');
    const res = await post();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'checkout-not-configured' });
  });
  it('maps an empty cart to 409', async () => {
    prepare.mockRejectedValue(new EmptyCart());
    const res = await post();
    expect([res.status, (await res.json()).error]).toEqual([409, 'cart-empty']);
  });
  it('maps capped lines to 422 with their ids', async () => {
    prepare.mockRejectedValue(new LinesUnavailable(['li-1']));
    const res = await post();
    expect([res.status, await res.json()]).toEqual([422, { error: 'lines-unavailable', lineItemIds: ['li-1'] }]);
  });
  it('maps disabled subscriptions to 422', async () => {
    prepare.mockRejectedValue(new SubscriptionsUnavailable());
    const res = await post();
    expect([res.status, (await res.json()).error]).toEqual([422, 'subscriptions-unavailable']);
  });
  it('maps an unusable API url to 503 not configured', async () => {
    create.mockRejectedValue(new CheckoutMisconfigured());
    const res = await post();
    expect([res.status, (await res.json()).error]).toEqual([503, 'checkout-not-configured']);
  });
  it('maps an unreachable Checkout to a controlled 502 without details', async () => {
    create.mockRejectedValue(new CheckoutUnavailable(404));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await post();
    expect([res.status, await res.json()]).toEqual([502, { error: 'checkout-unavailable' }]);
    expect(String(spy.mock.calls[0][0])).toBe('[checkout] session creation failed with status 404');
    spy.mockRestore();
  });
  it('an unknown failure is a sanitized 500', async () => {
    prepare.mockRejectedValue({ statusCode: 500, message: 'secret-token-abc' });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await post();
    expect(await res.text()).toBe('{"error":"Something went wrong"}');
    spy.mockRestore();
  });
  it('no commercetools type or token is in the JSON', async () => {
    const text = JSON.stringify(await (await post()).json());
    expect(text).not.toMatch(/version|lineItems|token|Bearer/);
  });
});

// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeShop, type FakeShop } from '@/test/fake-shop';

let shop: FakeShop;
vi.mock('@/lib/ct/client', () => ({ apiRoot: new Proxy({}, { get: (_t, p) => (shop.apiRoot as Record<string, unknown>)[p as string] }) }));

import { createCheckoutProvider, readCheckoutProviderConfig, regionFromApiUrl } from './checkout-provider';
import { PaymentUnavailableError, paymentModeNow } from '@/lib/checkout/payment-provider';
import { loadFakePaymentProvider } from '@/lib/ct/fixtures';

const config = {
  projectKey: 'proj',
  authUrl: 'https://auth.us-central1.gcp.commercetools.com',
  apiUrl: 'https://api.us-central1.gcp.commercetools.com',
  clientId: 'id-1',
  clientSecret: 'secret-xyz',
  applicationKey: 'storefront-checkout',
};

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const usd = (centAmount: number) => ({ centAmount, currencyCode: 'USD', fractionDigits: 2 });
beforeEach(() => {
  shop = createFakeShop();
});

describe('design-checkout: Payment through the payment widget: Checkout adapter', () => {
  it('derives the region from CTP_API_URL', () => {
    expect(regionFromApiUrl('https://api.us-central1.gcp.commercetools.com')).toBe('us-central1.gcp');
    expect(regionFromApiUrl('https://api.europe-west1.gcp.commercetools.com/')).toBe('europe-west1.gcp');
  });

  it('creates the session with the Sessions API: manage_sessions token, cart reference and the application key', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return url.includes('/oauth/token') ? reply({ access_token: 'tok-1', expires_in: 3600 }) : reply({ id: 'sess-9' });
    });
    const provider = createCheckoutProvider(config, fetchImpl as never);
    const session = await provider.createSession({ id: 'cart-1', total: usd(2025) });
    expect(session).toEqual({ sessionId: 'sess-9', projectKey: 'proj', region: 'us-central1.gcp' });
    expect(calls[0].url).toBe('https://auth.us-central1.gcp.commercetools.com/oauth/token');
    expect(String(calls[0].init.body)).toContain('scope=manage_sessions%3Aproj');
    expect(calls[1].url).toBe('https://session.us-central1.gcp.commercetools.com/proj/sessions');
    expect((calls[1].init.headers as Record<string, string>).authorization).toBe('Bearer tok-1');
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ cart: { cartRef: { id: 'cart-1' } }, metadata: { applicationKey: 'storefront-checkout' } });
  });

  it('reuses the token until it expires', async () => {
    const fetchImpl = vi.fn(async (url: string) => (url.includes('/oauth/token') ? reply({ access_token: 't', expires_in: 3600 }) : reply({ id: 's' })));
    const provider = createCheckoutProvider(config, fetchImpl as never);
    await provider.createSession({ id: 'a', total: usd(1) });
    await provider.createSession({ id: 'b', total: usd(1) });
    expect(fetchImpl.mock.calls.filter(([u]) => String(u).includes('/oauth/token'))).toHaveLength(1);
  });

  it('a failing Sessions API is "payment not available", and the secret is never in the error', async () => {
    const fetchImpl = vi.fn(async (url: string) => (url.includes('/oauth/token') ? reply({ access_token: 't' }) : reply({ message: 'nope secret-xyz' }, 500)));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const provider = createCheckoutProvider(config, fetchImpl as never);
    const failure = await provider.createSession({ id: 'a', total: usd(1) }).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(PaymentUnavailableError);
    expect(JSON.stringify([failure, spy.mock.calls])).not.toContain('secret-xyz');
    spy.mockRestore();
  });

  it('a failing token request is "payment not available"', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const provider = createCheckoutProvider(config, (async () => reply({}, 401)) as never);
    await expect(provider.createSession({ id: 'a', total: usd(1) })).rejects.toBeInstanceOf(PaymentUnavailableError);
    spy.mockRestore();
  });

  it('without the Checkout Application key (not configured) the adapter reports unavailable instead of guessing', () => {
    expect(() => readCheckoutProviderConfig({ CTP_PROJECT_KEY: 'p', CTP_AUTH_URL: 'a', CTP_API_URL: 'b', CTP_CLIENT_ID: 'c', CTP_CLIENT_SECRET: 'd' })).toThrow(PaymentUnavailableError);
    expect(readCheckoutProviderConfig({ CTP_PROJECT_KEY: 'p', CTP_AUTH_URL: 'a', CTP_API_URL: 'b', CTP_CLIENT_ID: 'c', CTP_CLIENT_SECRET: 'd', CTP_CHECKOUT_APP_KEY: 'k' }).applicationKey).toBe('k');
  });

  it('release cancels the payment through the Payment Intents API with its own scope', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return url.includes('/oauth/token') ? reply({ access_token: 'tok-2' }) : reply({}, 200);
    });
    await createCheckoutProvider(config, fetchImpl as never).release('pay/1');
    expect(String(calls[0].init.body)).toContain('scope=manage_checkout_payment_intents%3Aproj');
    expect(calls[1].url).toBe('https://checkout.us-central1.gcp.commercetools.com/proj/payment-intents/pay%2F1');
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ actions: [{ action: 'cancelPayment' }] });
  });

  it('refund asks the Payment Intents API for refundPayment with the amount (Checkout owns the lifecycle)', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return url.includes('/oauth/token') ? reply({ access_token: 'tok-3' }) : reply({}, 200);
    });
    await createCheckoutProvider(config, fetchImpl as never).refund('pay-1', usd(1875));
    expect(calls[1].url).toBe('https://checkout.us-central1.gcp.commercetools.com/proj/payment-intents/pay-1');
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ actions: [{ action: 'refundPayment', amount: { centAmount: 1875, currencyCode: 'USD' } }] });
  });

  it('a failing refund or release is "payment not available" and never claims success', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchImpl = vi.fn(async (url: string) => (url.includes('/oauth/token') ? reply({ access_token: 't' }) : reply({ message: 'nope' }, 400)));
    const provider = createCheckoutProvider(config, fetchImpl as never);
    await expect(provider.refund('p', usd(1))).rejects.toBeInstanceOf(PaymentUnavailableError);
    await expect(provider.release('p')).rejects.toBeInstanceOf(PaymentUnavailableError);
    spy.mockRestore();
  });

  it('the session is for the full flow: the cart and the Application key, no card data', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return url.includes('/oauth/token') ? reply({ access_token: 'tok' }) : reply({ id: 'sess-1' });
    });
    const session = await createCheckoutProvider(config, fetchImpl as never).createSession({ id: 'cart-1', total: usd(1875) });
    expect(session).toMatchObject({ sessionId: 'sess-1' });
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ cart: { cartRef: { id: 'cart-1' } }, metadata: { applicationKey: config.applicationKey } });
  });
});

describe('design-checkout: the fake provider is never active in production', () => {
  it('paymentModeNow is demo only with MALVA_FIXTURES=1 outside production', () => {
    expect(paymentModeNow({ MALVA_FIXTURES: '1', NODE_ENV: 'development' })).toBe('demo');
    expect(paymentModeNow({ MALVA_FIXTURES: '1', NODE_ENV: 'production' })).toBe('psp');
    expect(paymentModeNow({ NODE_ENV: 'development' })).toBe('psp');
  });

  it('loadFakePaymentProvider returns null in production and without the switch, the module otherwise', async () => {
    vi.stubEnv('MALVA_FIXTURES', '1');
    vi.stubEnv('NODE_ENV', 'production');
    expect(await loadFakePaymentProvider()).toBeNull();
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('MALVA_FIXTURES', '');
    expect(await loadFakePaymentProvider()).toBeNull();
    vi.stubEnv('MALVA_FIXTURES', '1');
    expect((await loadFakePaymentProvider())?.fakePaymentProvider.kind).toBe('demo');
    vi.unstubAllEnvs();
  });
});

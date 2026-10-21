import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  getEnv: () => ({
    CTP_PROJECT_KEY: 'spec-test-b2c-food', CTP_AUTH_URL: 'https://auth.us-central1.gcp.commercetools.com', CTP_API_URL: 'https://api.us-central1.gcp.commercetools.com',
    CTP_CLIENT_ID: 'id', CTP_CLIENT_SECRET: 'secret',
  }),
}));

import { createCheckoutSession, regionOf, sessionBody } from './checkout-session';

type Call = { url: string; init: RequestInit };
function fetcher(calls: Call[], sessionStatus = 201): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (url.includes('/oauth/token')) return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
    return new Response(JSON.stringify({ id: 'sess-1', expiryAt: '2026-10-21T16:00:00Z' }), { status: sessionStatus });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  process.env.CTP_CHECKOUT_APP_KEY = 'malva-checkout';
});

describe('checkout session', () => {
  it('Session body names the Application key and the future order number', async () => {
    const calls: Call[] = [];
    const r = await createCheckoutSession({ cartId: 'cart-1', orderNumber: 'MC-ABCDEFGHJK' }, fetcher(calls));
    expect(r).toEqual({ id: 'sess-1', projectKey: 'spec-test-b2c-food', region: 'us-central1.gcp', expiresAt: '2026-10-21T16:00:00Z' });
    expect(calls[1]?.url).toBe('https://session.us-central1.gcp.commercetools.com/spec-test-b2c-food/sessions');
    expect(JSON.parse(String(calls[1]?.init.body))).toEqual({
      cart: { cartRef: { id: 'cart-1' } },
      metadata: { applicationKey: 'malva-checkout', futureOrderNumber: 'MC-ABCDEFGHJK' },
    });
    expect(sessionBody('c', 'k', 'n').metadata).toEqual({ applicationKey: 'k', futureOrderNumber: 'n' });
  });
  it('asks for the manage_sessions scope only', async () => {
    const calls: Call[] = [];
    await createCheckoutSession({ cartId: 'cart-1', orderNumber: 'MC-ABCDEFGHJK' }, fetcher(calls));
    expect(String(calls[0]?.init.body)).toContain('manage_sessions%3Aspec-test-b2c-food');
  });
  it('derives the region from the API URL', () => {
    expect(regionOf('https://api.europe-west1.gcp.commercetools.com')).toBe('europe-west1.gcp');
    expect(regionOf('https://api.us-east-2.aws.commercetools.com/')).toBe('us-east-2.aws');
  });
  it('a refused session is an upstream error without the upstream body', async () => {
    await expect(createCheckoutSession({ cartId: 'c', orderNumber: 'n' }, fetcher([], 400))).rejects.toMatchObject({ code: 'upstream_unavailable' });
  });
  it('without an Application key the step is unavailable and nothing is called', async () => {
    delete process.env.CTP_CHECKOUT_APP_KEY;
    const calls: Call[] = [];
    await expect(createCheckoutSession({ cartId: 'c', orderNumber: 'n' }, fetcher(calls))).rejects.toMatchObject({ status: 503 });
    expect(calls).toHaveLength(0);
  });
});

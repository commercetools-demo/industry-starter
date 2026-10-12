// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveOrderNumber } from './order-number';
import { CheckoutMisconfigured, CheckoutUnavailable, createCheckoutSession, getSessionsToken, resetSessionsToken } from './session';

const fetchMock = vi.fn();
const tokenResponse = (expires_in = 3600) => new Response(JSON.stringify({ access_token: 'tok-abc', expires_in }), { status: 200 });
const sessionResponse = () => new Response(JSON.stringify({ id: 'sess-1', state: 'ACTIVE' }), { status: 201 });

beforeEach(() => {
  vi.stubEnv('CTP_API_URL', 'https://api.europe-west1.gcp.commercetools.com');
  vi.stubEnv('CTP_AUTH_URL', 'https://auth.europe-west1.gcp.commercetools.com');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  resetSessionsToken();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('createCheckoutSession', () => {
  it('body has cartRef and application key', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(sessionResponse());
    await createCheckoutSession({ cartId: 'cart-1', applicationKey: 'malva-app' });
    const [, init] = fetchMock.mock.calls[1];
    const body = JSON.parse(init.body as string);
    expect(body.cart).toEqual({ cartRef: { id: 'cart-1' } });
    expect(body.metadata.applicationKey).toBe('malva-app');
    expect(body.metadata.futureOrderNumber).toBe(deriveOrderNumber('cart-1'));
  });
  it('url uses the derived region and project key', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(sessionResponse());
    await createCheckoutSession({ cartId: 'cart-1', applicationKey: 'malva-app' });
    expect(fetchMock.mock.calls[1][0]).toBe('https://session.europe-west1.gcp.commercetools.com/test-project/sessions');
    expect(fetchMock.mock.calls[0][0]).toBe('https://auth.europe-west1.gcp.commercetools.com/oauth/token');
    expect(String(fetchMock.mock.calls[0][1].body)).toContain('manage_sessions%3Atest-project');
  });
  it('response carries project key and region, never the token', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(sessionResponse());
    const result = await createCheckoutSession({ cartId: 'cart-1', applicationKey: 'malva-app' });
    expect(result).toEqual({ sessionId: 'sess-1', projectKey: 'test-project', region: 'europe-west1.gcp' });
    expect(JSON.stringify(result)).not.toContain('tok-abc');
  });
  it('token is cached and not logged', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockImplementation(async () => sessionResponse());
    await createCheckoutSession({ cartId: 'cart-1', applicationKey: 'malva-app' });
    await createCheckoutSession({ cartId: 'cart-2', applicationKey: 'malva-app' });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/oauth/token'))).toHaveLength(1);
    expect(JSON.stringify([log.mock.calls, error.mock.calls])).not.toContain('tok-abc');
    log.mockRestore();
    error.mockRestore();
  });
  it('token is renewed 60 seconds before it expires', async () => {
    fetchMock.mockImplementation(async () => tokenResponse(120));
    const now = 1_000_000;
    await getSessionsToken(now);
    await getSessionsToken(now + 50_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await getSessionsToken(now + 61_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('non 2xx becomes CheckoutUnavailable without the body', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(new Response('{"message":"secret detail"}', { status: 404 }));
    const failure = await createCheckoutSession({ cartId: 'cart-1', applicationKey: 'missing' }).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(CheckoutUnavailable);
    expect((failure as CheckoutUnavailable).status).toBe(404);
    expect((failure as Error).message).not.toContain('secret');
  });
  it('an API url without a commercetools region is a configuration problem', async () => {
    vi.stubEnv('CTP_API_URL', 'http://localhost:4051');
    await expect(createCheckoutSession({ cartId: 'cart-1', applicationKey: 'a' })).rejects.toBeInstanceOf(CheckoutMisconfigured);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('dev hosts point session and widget at a local stand-in (development only)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('CTP_API_URL', 'http://localhost:4051');
    vi.stubEnv('CHECKOUT_DEV_SESSIONS_URL', 'http://localhost:4051/session');
    vi.stubEnv('CHECKOUT_DEV_APP_URL', 'http://localhost:4051/app');
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(sessionResponse());
    const result = await createCheckoutSession({ cartId: 'cart-1', applicationKey: 'a' });
    expect(fetchMock.mock.calls[1][0]).toBe('http://localhost:4051/session/test-project/sessions');
    expect(result.region).toBe('http://localhost:4051/app');
  });
  it('dev hosts are ignored in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CHECKOUT_DEV_SESSIONS_URL', 'http://localhost:4051/session');
    vi.stubEnv('CHECKOUT_DEV_APP_URL', 'http://localhost:4051/app');
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(sessionResponse());
    await createCheckoutSession({ cartId: 'cart-1', applicationKey: 'a' });
    expect(fetchMock.mock.calls[1][0]).toBe('https://session.europe-west1.gcp.commercetools.com/test-project/sessions');
  });
  it('a network failure is CheckoutUnavailable too', async () => {
    fetchMock.mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    await expect(createCheckoutSession({ cartId: 'cart-1', applicationKey: 'a' })).rejects.toBeInstanceOf(CheckoutUnavailable);
  });
  it('a refused token request is CheckoutUnavailable', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));
    await expect(createCheckoutSession({ cartId: 'cart-1', applicationKey: 'a' })).rejects.toMatchObject({ status: 401 });
  });
});

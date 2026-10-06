// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../env', async () => {
  const core = await vi.importActual<typeof import('../env-core')>('../env-core');
  return {
    getRegion: core.getRegion,
    validateEnv: () => ({
      CTP_PROJECT_KEY: 'proj',
      CTP_AUTH_URL: 'https://auth.us-central1.gcp.commercetools.com',
      CTP_API_URL: 'https://api.us-central1.gcp.commercetools.com',
      CTP_CLIENT_ID: 'cid',
      CTP_CLIENT_SECRET: 'sekret',
      CTP_SCOPES: 'manage_project:proj',
      CTP_CHECKOUT_APP_KEY: 'app-key',
      SESSION_SECRET: 'x'.repeat(32),
    }),
  };
});

import { CheckoutSessionError, createCheckoutSession } from './checkout-session';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.restoreAllMocks());

describe('createCheckoutSession', () => {
  it('requests a manage_sessions token with Basic auth, then creates the session', async () => {
    fetchMock.mockResolvedValueOnce(json({ access_token: 'tok-123' })).mockResolvedValueOnce(json({ id: 'sess-1', state: 'ACTIVE' }));

    const result = await createCheckoutSession('cart-1');

    expect(result).toEqual({ sessionId: 'sess-1', projectKey: 'proj', region: 'us-central1.gcp' });
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(tokenUrl).toBe('https://auth.us-central1.gcp.commercetools.com/oauth/token');
    expect(tokenInit.method).toBe('POST');
    expect((tokenInit.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from('cid:sekret').toString('base64')}`);
    const params = new URLSearchParams(tokenInit.body as string);
    expect(params.get('grant_type')).toBe('client_credentials');
    expect(params.get('scope')).toBe('manage_sessions:proj');

    const [sessionUrl, sessionInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(sessionUrl).toBe('https://session.us-central1.gcp.commercetools.com/proj/sessions');
    expect((sessionInit.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
    expect(JSON.parse(sessionInit.body as string)).toEqual({ cart: { cartRef: { id: 'cart-1' } }, metadata: { applicationKey: 'app-key' } });
  });

  it('token request fails: TOKEN_FAILED and no session call', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: 'invalid_client' }, 401));
    await expect(createCheckoutSession('c')).rejects.toMatchObject({ name: 'CheckoutSessionError', code: 'TOKEN_FAILED', status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sessions API answers non-2xx: SESSION_FAILED', async () => {
    fetchMock.mockResolvedValueOnce(json({ access_token: 't' })).mockResolvedValueOnce(json({ message: 'nope' }, 400));
    await expect(createCheckoutSession('c')).rejects.toMatchObject({ code: 'SESSION_FAILED', status: 400 });
  });

  it('network failure and a response without id map to typed errors', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom'));
    await expect(createCheckoutSession('c')).rejects.toBeInstanceOf(CheckoutSessionError);
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(json({ access_token: 't' })).mockResolvedValueOnce(json({}));
    await expect(createCheckoutSession('c')).rejects.toMatchObject({ code: 'SESSION_FAILED' });
  });

  it('never logs or leaks the token or the secret', async () => {
    const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'info')];
    fetchMock.mockResolvedValueOnce(json({ access_token: 'tok-secret-xyz' })).mockResolvedValueOnce(json({ message: 'bad' }, 500));
    const error = await createCheckoutSession('c').catch((e: unknown) => e);
    expect(String((error as Error).message)).not.toMatch(/tok-secret-xyz|sekret/);
    for (const spy of spies) expect(JSON.stringify(spy.mock.calls)).not.toMatch(/tok-secret-xyz|sekret/);
  });
});

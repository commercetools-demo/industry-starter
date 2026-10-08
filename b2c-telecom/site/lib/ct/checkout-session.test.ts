import { afterEach, describe, expect, it, vi } from 'vitest';
import { CheckoutSessionError, createCheckoutSession } from './checkout-session';

const ENV = {
  CTP_PROJECT_KEY: 'proj',
  CTP_AUTH_URL: 'https://auth.us-central1.gcp.commercetools.com',
  CTP_API_URL: 'https://api.us-central1.gcp.commercetools.com',
  CTP_CLIENT_ID: 'id',
  CTP_CLIENT_SECRET: 'sec-sec-sec',
  CTP_SCOPES: 'x',
  SESSION_SECRET: 'a-session-secret-that-is-long-enough-0123',
  CTP_CHECKOUT_APP_KEY: 'app-key',
};

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

afterEach(() => vi.unstubAllGlobals());

describe('createCheckoutSession', () => {
  it('asks for a manage_sessions token with Basic auth and posts the exact session body with futureOrderNumber', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(ok({ access_token: 'tok' })).mockResolvedValueOnce(ok({ id: 'sess-1', expiryAt: '2026-10-07T10:00:00Z' }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await createCheckoutSession('cart-1', 'MLV-7K3F9QXD', ENV);
    expect(result).toEqual({ sessionId: 'sess-1', projectKey: 'proj', region: 'us-central1.gcp', expiresAt: '2026-10-07T10:00:00Z' });
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(tokenUrl).toBe('https://auth.us-central1.gcp.commercetools.com/oauth/token');
    expect(tokenInit.body).toBe('grant_type=client_credentials&scope=manage_sessions:proj');
    expect((tokenInit.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from('id:sec-sec-sec').toString('base64')}`);
    const [sessionUrl, sessionInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(sessionUrl).toBe('https://session.us-central1.gcp.commercetools.com/proj/sessions');
    expect(JSON.parse(sessionInit.body as string)).toEqual({ cart: { cartRef: { id: 'cart-1' } }, metadata: { applicationKey: 'app-key', futureOrderNumber: 'MLV-7K3F9QXD' } });
  });

  it('a failed token or session is a typed error whose message carries neither token nor body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{"secret":"x"}', { status: 401 })));
    await expect(createCheckoutSession('c', 'MLV-AAAAAAAA', ENV)).rejects.toMatchObject({ code: 'TOKEN_FAILED' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(ok({ access_token: 'tok-secret' })).mockResolvedValueOnce(new Response('{"leak":"tok-secret"}', { status: 500 })));
    const error = await createCheckoutSession('c', 'MLV-AAAAAAAA', ENV).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CheckoutSessionError);
    expect((error as Error).message).not.toContain('tok-secret');
    expect((error as CheckoutSessionError).code).toBe('SESSION_FAILED');
  });

  it('a duplicate order number is recognised', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(ok({ access_token: 't' })).mockResolvedValueOnce(new Response(JSON.stringify({ errors: [{ code: 'DuplicateField', field: 'orderNumber' }] }), { status: 400 })));
    await expect(createCheckoutSession('c', 'MLV-AAAAAAAA', ENV)).rejects.toMatchObject({ code: 'DUPLICATE_ORDER_NUMBER' });
  });

  it('without a Checkout application key nothing is requested', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(createCheckoutSession('c', 'MLV-AAAAAAAA', { ...ENV, CTP_CHECKOUT_APP_KEY: '' })).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

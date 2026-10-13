import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkoutHost, CheckoutError, refundPayment, resetCheckoutToken } from './checkout-payments';

const config = { projectKey: 'proj', apiUrl: 'https://api.europe-west1.gcp.commercetools.com', authUrl: 'https://auth.europe-west1.gcp.commercetools.com', clientId: 'id', clientSecret: 'shh' };

const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

beforeEach(() => resetCheckoutToken());

describe('refund goes through checkout', () => {
  it('derives the Checkout host from the API URL', () => {
    expect(checkoutHost(config.apiUrl)).toBe('https://checkout.europe-west1.gcp.commercetools.com');
    expect(() => checkoutHost('https://example.com')).toThrow();
  });

  it('posts one refundPayment action with the amount to the Payment Intents path, with its own narrow scope', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => (String(url).endsWith('/oauth/token') ? respond(200, { access_token: 't', expires_in: 3600 }) : respond(200, { outcome: 'received' })));
    const result = await refundPayment('pay-1', { centAmount: 1500, currencyCode: 'EUR' }, { config, fetcher: fetcher as unknown as typeof fetch });
    expect(result).toEqual({ outcome: 'received' });
    const [tokenCall, refundCall] = fetcher.mock.calls as unknown as [string, RequestInit][];
    expect(String((tokenCall[1].body as URLSearchParams).get('scope'))).toBe('manage_checkout_payment_intents:proj');
    expect(refundCall[0]).toBe('https://checkout.europe-west1.gcp.commercetools.com/proj/payment-intents/pay-1');
    expect(JSON.parse(String(refundCall[1].body))).toEqual({ actions: [{ action: 'refundPayment', amount: { centAmount: 1500, currencyCode: 'EUR' } }] });
    expect((refundCall[1].headers as Record<string, string>).authorization).toBe('Bearer t');
  });

  it('never writes a Payment transaction and keeps the response body out of the error', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => (String(url).endsWith('/oauth/token') ? respond(200, { access_token: 't', expires_in: 3600 }) : respond(500, { secret: 'stripe-detail' })));
    const failure = await refundPayment('pay-1', { centAmount: 1, currencyCode: 'EUR' }, { config, fetcher: fetcher as unknown as typeof fetch }).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(CheckoutError);
    expect((failure as Error).message).not.toContain('stripe-detail');
    for (const [url] of fetcher.mock.calls as unknown as [string][]) expect(url).not.toContain('/transactions');
  });
});

import 'server-only';
import type { Payment } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { log } from '@/lib/log';
import { PaymentUnavailableError, type AuthorizationState, type PaymentCartRef, type PaymentProvider } from '@/lib/checkout/payment-provider';

/**
 * The real adapter: commercetools Checkout in payment-only mode (D-026; Stripe sandbox connector, OA-04).
 *
 *  - session: `POST https://session.{region}.commercetools.com/{projectKey}/sessions` (scope `manage_sessions`)
 *    with the cart and the Checkout Application key; the browser SDK (`paymentFlow`) takes the session id;
 *  - authorization: read from the platform. Checkout creates a Payment on the cart; an `Authorization` transaction
 *    in state `Success` means authorized, `Failure` means declined. The browser's word is never trusted;
 *  - release: the Checkout Payment Intents API `cancelPayment`
 *    (`POST https://checkout.{region}.commercetools.com/{projectKey}/payment-intents/{paymentId}`, scope
 *    `manage_checkout_payment_intents`).
 *
 * Needs `CTP_CHECKOUT_APP_KEY` (the Application's key; not a secret). Credentials come from the same API client as
 * the rest of the BFF and are never logged. Without the Application key every call throws `PaymentUnavailableError`.
 */

export interface CheckoutProviderConfig {
  projectKey: string;
  authUrl: string;
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  applicationKey: string;
}

/** `https://api.us-central1.gcp.commercetools.com` -> `us-central1.gcp`. */
export function regionFromApiUrl(apiUrl: string): string {
  return apiUrl.trim().replace(/^https?:\/\/api\./, '').replace(/\.commercetools\.com\/?$/, '');
}

export function readCheckoutProviderConfig(env: Record<string, string | undefined> = process.env): CheckoutProviderConfig {
  const get = (name: string) => env[name]?.trim() ?? '';
  const config = {
    projectKey: get('CTP_PROJECT_KEY'),
    authUrl: get('CTP_AUTH_URL'),
    apiUrl: get('CTP_API_URL'),
    clientId: get('CTP_CLIENT_ID'),
    clientSecret: get('CTP_CLIENT_SECRET'),
    applicationKey: get('CTP_CHECKOUT_APP_KEY'),
  };
  if (Object.values(config).some((v) => !v)) throw new PaymentUnavailableError();
  return config;
}

type Fetch = typeof fetch;

interface TokenCache {
  token: string;
  expiresAt: number;
}

/** Latest payment on the cart that carries an Authorization transaction decides the state. */
export function authorizationOf(payments: Pick<Payment, 'id' | 'createdAt' | 'transactions' | 'amountPlanned'>[]): AuthorizationState {
  const sorted = [...payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const payment of sorted) {
    const auths = payment.transactions.filter((t) => t.type === 'Authorization');
    const success = auths.find((t) => t.state === 'Success');
    if (success) return { status: 'authorized', paymentId: payment.id, centAmount: success.amount.centAmount, currencyCode: success.amount.currencyCode };
    if (auths.some((t) => t.state === 'Failure')) return { status: 'declined', paymentId: payment.id };
  }
  return { status: 'none' };
}

export function createCheckoutProvider(config: CheckoutProviderConfig = readCheckoutProviderConfig(), fetchImpl: Fetch = fetch): PaymentProvider {
  const region = regionFromApiUrl(config.apiUrl);
  const tokens = new Map<string, TokenCache>();

  async function token(scope: string): Promise<string> {
    const cached = tokens.get(scope);
    if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;
    const response = await fetchImpl(`${config.authUrl.replace(/\/$/, '')}/oauth/token`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope: `${scope}:${config.projectKey}` }),
    });
    if (!response.ok) {
      log.error('checkout', 'token request failed', { status: response.status });
      throw new PaymentUnavailableError();
    }
    const body = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) throw new PaymentUnavailableError();
    tokens.set(scope, { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 300) * 1000 });
    return body.access_token;
  }

  return {
    kind: 'psp',

    async createSession(cart: PaymentCartRef) {
      const bearer = await token('manage_sessions');
      const response = await fetchImpl(`https://session.${region}.commercetools.com/${config.projectKey}/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${bearer}` },
        body: JSON.stringify({ cart: { cartRef: { id: cart.id } }, metadata: { applicationKey: config.applicationKey } }),
      });
      if (!response.ok) {
        log.error('checkout', 'session request failed', { status: response.status });
        throw new PaymentUnavailableError();
      }
      const body = (await response.json()) as { id?: string };
      if (!body.id) throw new PaymentUnavailableError();
      return { sessionId: body.id, projectKey: config.projectKey, region };
    },

    async getAuthorization(cartId: string): Promise<AuthorizationState> {
      const { body } = await apiRoot.carts().withId({ ID: cartId }).get({ queryArgs: { expand: ['paymentInfo.payments[*]'] } }).execute();
      const payments = (body.paymentInfo?.payments ?? []).map((ref) => ref.obj).filter((p): p is Payment => p !== undefined);
      return authorizationOf(payments);
    },

    async release(paymentId: string): Promise<void> {
      const bearer = await token('manage_checkout_payment_intents');
      const response = await fetchImpl(`https://checkout.${region}.commercetools.com/${config.projectKey}/payment-intents/${encodeURIComponent(paymentId)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${bearer}` },
        body: JSON.stringify({ actions: [{ action: 'cancelPayment' }] }),
      });
      if (!response.ok) {
        log.error('checkout', 'release request failed', { status: response.status });
        throw new PaymentUnavailableError();
      }
    },
  };
}

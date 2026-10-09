import 'server-only';
import { listStored, removeStored, setDefaultStored } from '@/lib/ct/stored-methods';
import { log } from '@/lib/log';
import { PaymentUnavailableError, type PaymentCartRef, type PaymentProvider } from '@/lib/checkout/payment-provider';

/**
 * The real adapter: the full commercetools Checkout (`checkoutFlow`, D-034; Stripe sandbox connector, OA-04).
 *
 *  - session: `POST https://session.{region}.commercetools.com/{projectKey}/sessions` (scope `manage_sessions`)
 *    with the cart and the Checkout Application key; the browser SDK (`checkoutFlow`) takes the session id. Checkout
 *    authorizes the payment AND creates the order;
 *  - release / refund: the Checkout Payment Intents API (`cancelPayment`, `refundPayment`)
 *    (`POST https://checkout.{region}.commercetools.com/{projectKey}/payment-intents/{paymentId}`, scope
 *    `manage_checkout_payment_intents`). Capture is not modelled here: it is Checkout's lifecycle (D-035).
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

  async function intent(paymentId: string, action: Record<string, unknown>, what: string): Promise<void> {
    const bearer = await token('manage_checkout_payment_intents');
    const response = await fetchImpl(`https://checkout.${region}.commercetools.com/${config.projectKey}/payment-intents/${encodeURIComponent(paymentId)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ actions: [action] }),
    });
    if (!response.ok) {
      log.error('checkout', `${what} request failed`, { status: response.status });
      throw new PaymentUnavailableError();
    }
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

    async release(paymentId: string): Promise<void> {
      await intent(paymentId, { action: 'cancelPayment' }, 'release');
    },

    async refund(paymentId: string, amount: { centAmount: number; currencyCode: string }): Promise<void> {
      await intent(paymentId, { action: 'refundPayment', amount: { centAmount: amount.centAmount, currencyCode: amount.currencyCode } }, 'refund');
    },

    // Saved methods live on the PaymentMethod API (Checkout Stored Payment Methods, OA-04), see lib/ct/stored-methods.ts.
    listStoredMethods: (customerId: string) => listStored(customerId),
    setDefaultStoredMethod: (customerId: string, methodId: string) => setDefaultStored(customerId, methodId),
    removeStoredMethod: (customerId: string, methodId: string) => removeStored(customerId, methodId),
  };
}

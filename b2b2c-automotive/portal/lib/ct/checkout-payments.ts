// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The one file that talks to the commercetools Checkout Payment Intents API (workstream V-12, D6). Refunds of returns go through
// the payment: `POST https://checkout.<region>.commercetools.com/<projectKey>/payment-intents/<paymentId>` with
// `{ actions: [{ action: 'refundPayment', amount: { centAmount, currencyCode } }] }` (OAS `checkout-PaymentIntent`; one action per
// request). The response outcome is `approved`, `rejected` or `received` (processed asynchronously); the connector then adds a Refund
// Transaction to the existing Payment whose state turns Success or Failure when Stripe confirms. The portal never writes a Payment
// transaction itself. The Checkout host is not served by the SDK, so this file calls fetch (eslint exemption like the Import API).
// Scope `manage_checkout_payment_intents:<projectKey>` must be in CTP_ADMIN_SCOPES; the token requested here asks for that one scope only.
import 'server-only';
import { validatePortalEnv } from '@/lib/env';
import { devFixturesEnabled } from '@/lib/portal/seam';

export const REFUND_SCOPE = 'manage_checkout_payment_intents';

export interface Amount {
  centAmount: number;
  currencyCode: string;
}
export type RefundOutcome = 'approved' | 'rejected' | 'received';

/** `https://api.<region>.<cloud>.commercetools.com` becomes `https://checkout.<region>.<cloud>.commercetools.com`. */
export function checkoutHost(apiUrl: string): string {
  const url = new URL(apiUrl);
  if (!url.hostname.startsWith('api.')) throw new Error('CTP_API_URL must start with api.');
  url.hostname = `checkout.${url.hostname.slice('api.'.length)}`;
  return url.origin;
}

export interface LiveConfig {
  projectKey: string;
  apiUrl: string;
  authUrl: string;
  clientId: string;
  clientSecret: string;
}

export class CheckoutError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'CheckoutError';
  }
}

let cachedToken: { value: string; expires: number } | undefined;

/** Test hook: forget the cached token. */
export function resetCheckoutToken(): void {
  cachedToken = undefined;
}

async function token(config: LiveConfig, fetcher: typeof fetch): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now()) return cachedToken.value;
  const body = new URLSearchParams({ grant_type: 'client_credentials', scope: `${REFUND_SCOPE}:${config.projectKey}` });
  const response = await fetcher(`${config.authUrl.replace(/\/$/, '')}/oauth/token`, {
    method: 'POST',
    headers: { authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) throw new CheckoutError(502, `Checkout token request failed (${response.status})`);
  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.value;
}

/**
 * Asks Checkout to refund `amount` of the Payment. Returns the outcome; throws `CheckoutError` for a failed call (the message never
 * contains the response body). Never marks anything as successful: the Refund transaction state comes from the connector.
 */
export async function refundPayment(paymentId: string, amount: Amount, options: { config?: LiveConfig; fetcher?: typeof fetch } = {}): Promise<{ outcome: RefundOutcome }> {
  if (!options.config && devFixturesEnabled()) {
    const { getVFixture } = await import('@/lib/portal/v-fixture-root');
    return getVFixture().refundPayment(paymentId, amount);
  }
  const config = options.config ?? validatePortalEnv(process.env).admin;
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(`${checkoutHost(config.apiUrl)}/${encodeURIComponent(config.projectKey)}/payment-intents/${encodeURIComponent(paymentId)}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${await token(config, fetcher)}`, 'content-type': 'application/json' },
    body: JSON.stringify({ actions: [{ action: 'refundPayment', amount: { centAmount: amount.centAmount, currencyCode: amount.currencyCode } }] }),
    cache: 'no-store',
  });
  if (!response.ok) throw new CheckoutError(response.status === 404 ? 404 : 502, `Checkout refund request failed (${response.status})`);
  const data = (await response.json()) as { outcome?: RefundOutcome };
  if (data.outcome !== 'approved' && data.outcome !== 'rejected' && data.outcome !== 'received') throw new CheckoutError(502, 'Checkout answered without an outcome');
  return { outcome: data.outcome };
}

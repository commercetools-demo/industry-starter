import 'server-only';
import { getEnv } from '@/lib/env';
import { AppError } from '@/lib/errors';

/**
 * Checkout Session (workstream K, 3.5). The Sessions API is the one documented call that is not in the SDK, so this module uses
 * `fetch` (the exception named by task K-07). Flow: a client-credentials token with scope `manage_sessions:<project>`, then
 * `POST https://session.<region>.<host>/<project>/sessions` with the cart reference, the Application key and the future
 * order number. Create the session late (when the shopper presses "Continue to secure checkout"): sessions expire.
 */

const HOST = 'commercetools.com';

/** The API URL `https://api.<region>.<host>` gives `<region>`, for example `us-central1.gcp` (the skill derives it the same way). */
export function regionOf(apiUrl: string): string {
  return apiUrl.replace(/^https?:\/\/api\./, '').replace(new RegExp(`\\.${HOST.replace('.', '\\.')}/?$`), '');
}

export interface CheckoutSessionResult {
  id: string;
  projectKey: string;
  region: string;
  expiresAt: string | null;
}

export function sessionBody(cartId: string, applicationKey: string, futureOrderNumber: string) {
  return { cart: { cartRef: { id: cartId } }, metadata: { applicationKey, futureOrderNumber } };
}

export async function createCheckoutSession(
  input: { cartId: string; orderNumber: string },
  fetcher: typeof fetch = fetch,
): Promise<CheckoutSessionResult> {
  const env = getEnv();
  const applicationKey = process.env.CTP_CHECKOUT_APP_KEY?.trim();
  if (!applicationKey) throw new AppError('upstream_unavailable', 503);
  const region = regionOf(env.CTP_API_URL);
  try {
    const tokenRes = await fetcher(`${env.CTP_AUTH_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${env.CTP_CLIENT_ID}:${env.CTP_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope: `manage_sessions:${env.CTP_PROJECT_KEY}` }),
    });
    if (!tokenRes.ok) throw new AppError('upstream_unavailable', 502);
    const { access_token: token } = (await tokenRes.json()) as { access_token?: string };
    if (!token) throw new AppError('upstream_unavailable', 502);
    const res = await fetcher(`https://session.${region}.${HOST}/${env.CTP_PROJECT_KEY}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(sessionBody(input.cartId, applicationKey, input.orderNumber)),
    });
    if (!res.ok) throw new AppError('upstream_unavailable', 502);
    const data = (await res.json()) as { id?: string; expiryAt?: string };
    if (!data.id) throw new AppError('upstream_unavailable', 502);
    return { id: data.id, projectKey: env.CTP_PROJECT_KEY, region, expiresAt: data.expiryAt ?? null };
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError('upstream_unavailable', 502);
  }
}

import 'server-only';
import { getRegion, validateEnv } from '../env';

export type CheckoutSessionErrorCode = 'TOKEN_FAILED' | 'SESSION_FAILED';

/** A failed token or Sessions API call. The message never contains the token, the secret or response bodies. */
export class CheckoutSessionError extends Error {
  readonly code: CheckoutSessionErrorCode;
  readonly status?: number;
  constructor(code: CheckoutSessionErrorCode, status?: number) {
    super(`Checkout session failed (${code}${status ? ` ${status}` : ''})`);
    this.name = 'CheckoutSessionError';
    this.code = code;
    if (status !== undefined) this.status = status;
  }
}

/** What the browser needs to start the hosted flow (no secrets). */
export interface CheckoutSession {
  sessionId: string;
  projectKey: string;
  region: string;
}

async function getSessionsToken(env: ReturnType<typeof validateEnv>): Promise<string> {
  const basic = Buffer.from(`${env.CTP_CLIENT_ID}:${env.CTP_CLIENT_SECRET}`).toString('base64');
  let res: Response;
  try {
    res = await fetch(`${env.CTP_AUTH_URL.replace(/\/+$/, '')}/oauth/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope: `manage_sessions:${env.CTP_PROJECT_KEY}` }).toString(),
      cache: 'no-store',
    });
  } catch {
    throw new CheckoutSessionError('TOKEN_FAILED');
  }
  if (!res.ok) throw new CheckoutSessionError('TOKEN_FAILED', res.status);
  const body: unknown = await res.json().catch(() => null);
  const token = typeof body === 'object' && body !== null ? (body as { access_token?: unknown }).access_token : undefined;
  if (typeof token !== 'string' || token === '') throw new CheckoutSessionError('TOKEN_FAILED', res.status);
  return token;
}

/**
 * Creates a Checkout Session for the cart (Sessions API, `manage_sessions` token) for the hosted Complete Checkout
 * application `CTP_CHECKOUT_APP_KEY`. The only module that calls commercetools with a raw `fetch`.
 */
export async function createCheckoutSession(cartId: string): Promise<CheckoutSession> {
  const env = validateEnv();
  const region = getRegion(env.CTP_API_URL);
  const token = await getSessionsToken(env);
  let res: Response;
  try {
    res = await fetch(`https://session.${region}.commercetools.com/${env.CTP_PROJECT_KEY}/sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cart: { cartRef: { id: cartId } }, metadata: { applicationKey: env.CTP_CHECKOUT_APP_KEY } }),
      cache: 'no-store',
    });
  } catch {
    throw new CheckoutSessionError('SESSION_FAILED');
  }
  if (!res.ok) throw new CheckoutSessionError('SESSION_FAILED', res.status);
  const body: unknown = await res.json().catch(() => null);
  const id = typeof body === 'object' && body !== null ? (body as { id?: unknown }).id : undefined;
  if (typeof id !== 'string' || id === '') throw new CheckoutSessionError('SESSION_FAILED', res.status);
  return { sessionId: id, projectKey: env.CTP_PROJECT_KEY, region };
}

import 'server-only';
import { getRegion, validateEnv } from './env-core';

// The only raw `fetch` to commercetools in the storefront: the Checkout Sessions API has no SDK builder. The token and the response body
// never appear in an error message (codes only).

export class CheckoutSessionError extends Error {
  constructor(
    readonly code: 'TOKEN_FAILED' | 'SESSION_FAILED' | 'DUPLICATE_ORDER_NUMBER' | 'NOT_CONFIGURED',
    readonly status?: number,
  ) {
    super(`Checkout session failed: ${code}${status === undefined ? '' : ` (${status})`}`);
    this.name = 'CheckoutSessionError';
  }
}

export interface CreatedSession {
  sessionId: string;
  projectKey: string;
  region: string;
  expiresAt?: string;
}

async function sessionsToken(authUrl: string, projectKey: string, clientId: string, clientSecret: string): Promise<string> {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  let response: Response;
  try {
    response = await fetch(`${authUrl.replace(/\/$/, '')}/oauth/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&scope=manage_sessions:${projectKey}`,
      cache: 'no-store',
    });
  } catch {
    throw new CheckoutSessionError('TOKEN_FAILED');
  }
  if (!response.ok) throw new CheckoutSessionError('TOKEN_FAILED', response.status);
  const body = (await response.json().catch(() => null)) as { access_token?: unknown } | null;
  if (typeof body?.access_token !== 'string') throw new CheckoutSessionError('TOKEN_FAILED', response.status);
  return body.access_token;
}

/** Creates the hosted Checkout session for a cart, with the order number the order will get (`futureOrderNumber`). */
export async function createCheckoutSession(cartId: string, orderNumber: string, source: Record<string, string | undefined> = process.env): Promise<CreatedSession> {
  const env = validateEnv(source);
  const applicationKey = env.CTP_CHECKOUT_APP_KEY;
  if (!applicationKey) throw new CheckoutSessionError('NOT_CONFIGURED');
  const projectKey = env.CTP_PROJECT_KEY;
  const region = getRegion(env.CTP_API_URL);
  const token = await sessionsToken(env.CTP_AUTH_URL, projectKey, env.CTP_CLIENT_ID, env.CTP_CLIENT_SECRET);
  let response: Response;
  try {
    response = await fetch(`https://session.${region}.commercetools.com/${projectKey}/sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cart: { cartRef: { id: cartId } }, metadata: { applicationKey, futureOrderNumber: orderNumber } }),
      cache: 'no-store',
    });
  } catch {
    throw new CheckoutSessionError('SESSION_FAILED');
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { errors?: { code?: unknown; field?: unknown }[] } | null;
    const duplicate = response.status === 400 && body?.errors?.some((error) => error.code === 'DuplicateField' && error.field === 'orderNumber');
    throw new CheckoutSessionError(duplicate ? 'DUPLICATE_ORDER_NUMBER' : 'SESSION_FAILED', response.status);
  }
  const body = (await response.json().catch(() => null)) as { id?: unknown; expiryAt?: unknown } | null;
  if (typeof body?.id !== 'string') throw new CheckoutSessionError('SESSION_FAILED', response.status);
  return { sessionId: body.id, projectKey, region, ...(typeof body.expiryAt === 'string' ? { expiresAt: body.expiryAt } : {}) };
}

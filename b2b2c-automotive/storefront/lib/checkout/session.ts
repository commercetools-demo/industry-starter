// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Checkout Sessions API (O D3): `POST https://session.{region}.commercetools.com/{projectKey}/sessions` with a bearer token of the
// `manage_sessions` scope. The token comes from the client credentials of the storefront's own API client and is cached in memory until
// 60 seconds before it expires. Neither the token nor a response body is ever logged or put in an error.
import 'server-only';
import { validateEnv } from '@/lib/env';
import { checkoutDevHosts } from '@/lib/checkout/env';
import { deriveRegion } from '@/lib/checkout/region';
import { deriveOrderNumber } from '@/lib/checkout/order-number';

export class CheckoutUnavailable extends Error {
  constructor(readonly status: number | null) {
    super(status ? `Checkout unavailable (status ${status})` : 'Checkout unavailable');
    this.name = 'CheckoutUnavailable';
  }
}

/** The API URL does not name a commercetools region (a local or unusual setup): a configuration problem, not an outage. */
export class CheckoutMisconfigured extends Error {
  constructor() {
    super('Checkout region cannot be derived from the API URL');
    this.name = 'CheckoutMisconfigured';
  }
}

export interface CheckoutSessionResult {
  sessionId: string;
  projectKey: string;
  region: string;
}

let cached: { token: string; expiresAt: number } | null = null;

/** Test hook: forget the cached token. */
export function resetSessionsToken(): void {
  cached = null;
}

/** The token for the Sessions API: client credentials with `manage_sessions:{projectKey}` (the scope also sits in CTP_SCOPES, see `.env.example`). */
export async function getSessionsToken(now: number = Date.now()): Promise<string> {
  if (cached && cached.expiresAt - 60_000 > now) return cached.token;
  const { frontend } = validateEnv(process.env);
  const basic = Buffer.from(`${frontend.clientId}:${frontend.clientSecret}`).toString('base64');
  const scope = `manage_sessions:${frontend.projectKey}`;
  let response: Response;
  try {
    response = await fetch(`${frontend.authUrl.replace(/\/+$/, '')}/oauth/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope }).toString(),
      cache: 'no-store',
    });
  } catch {
    throw new CheckoutUnavailable(null);
  }
  if (!response.ok) throw new CheckoutUnavailable(response.status);
  const body = (await response.json().catch(() => null)) as { access_token?: unknown; expires_in?: unknown } | null;
  if (!body || typeof body.access_token !== 'string') throw new CheckoutUnavailable(response.status);
  const lifetime = typeof body.expires_in === 'number' ? body.expires_in : 3600;
  cached = { token: body.access_token, expiresAt: now + lifetime * 1000 };
  return cached.token;
}

export interface CreateSessionInput {
  cartId: string;
  applicationKey: string;
}

/**
 * Creates the session for the cart as late as possible (sessions expire). `futureOrderNumber` is the number the order will carry
 * (`MA-` plus 8 characters derived from the cart id); a duplicate would stop the order, which cannot happen for one cart.
 */
export async function createCheckoutSession(input: CreateSessionInput): Promise<CheckoutSessionResult> {
  const { frontend } = validateEnv(process.env);
  const dev = checkoutDevHosts();
  let region: string;
  try {
    region = dev ? dev.appUrl : deriveRegion(frontend.apiUrl);
  } catch {
    throw new CheckoutMisconfigured();
  }
  const sessionsBase = dev ? dev.sessionsUrl : `https://session.${region}.commercetools.com`;
  const token = await getSessionsToken();
  let response: Response;
  try {
    // The Checkout Sessions API has no entry in the platform SDK (`apiRoot`), so this is the one raw call to a commercetools host.
    response = await fetch(`${sessionsBase}/${frontend.projectKey}/sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cart: { cartRef: { id: input.cartId } },
        metadata: { applicationKey: input.applicationKey, futureOrderNumber: deriveOrderNumber(input.cartId) },
      }),
      cache: 'no-store',
    });
  } catch {
    throw new CheckoutUnavailable(null);
  }
  if (!response.ok) throw new CheckoutUnavailable(response.status);
  const body = (await response.json().catch(() => null)) as { id?: unknown } | null;
  if (!body || typeof body.id !== 'string') throw new CheckoutUnavailable(response.status);
  return { sessionId: body.id, projectKey: frontend.projectKey, region };
}

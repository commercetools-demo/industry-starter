// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `POST /api/impersonate` (workstream V-06): the landing of "Shop as customer". The portal opens a new tab that POSTs a form with the single
// field `token` (a JWT, never in a URL). The route verifies the 60 second HS256 token with the shared `IMPERSONATION_SECRET`, claims the
// single-use record `malva-impersonation/<jti>` (issued to active), starts the session of that customer in the token's store and redirects
// 303 to the account. EVERY failure is the same generic 404 page: no reason, no token, no secret, no commercetools message.
import { getImpersonationSecret } from '@/lib/env';
import { claimHandoff } from '@/lib/ct/impersonation';
import { getStoreContext } from '@/lib/ct/stores';
import { verifyHandoff } from '@/lib/impersonation/handoff';
import { startImpersonation } from '@/lib/impersonation/state';
import { getLocale, getSession, setSessionCookie } from '@/lib/session';
import { applyStore } from '@/lib/session-core';

/** Where the seller lands (the account area is workstream Q). */
const IMPERSONATION_LANDING_PATH = '/account';
const MAX_TOKEN_LENGTH = 4096;

const HEADERS = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } as const;
const notFound = (): Response =>
  new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Not found</title></head><body><h1>Not found</h1></body></html>', {
    status: 404,
    headers: { ...HEADERS, 'Content-Type': 'text/html; charset=utf-8' },
  });

export async function POST(request: Request): Promise<Response> {
  try {
    const secret = getImpersonationSecret();
    if (!secret || !(request.headers.get('content-type') ?? '').includes('application/x-www-form-urlencoded')) return notFound();
    const token = (await request.formData()).get('token');
    if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return notFound();

    const claims = await verifyHandoff(token, secret);
    const store = await getStoreContext(claims.storeKey);
    if (!store || store.storeKey !== claims.storeKey) return notFound();
    if (!(await claimHandoff(claims))) return notFound();

    const { locale } = await getLocale();
    const session = applyStore(startImpersonation(await getSession(), { customerId: claims.customerId, actorId: claims.actorId, jti: claims.jti }, new Date()), store);
    await setSessionCookie(session);
    return new Response(null, {
      status: 303,
      headers: { ...HEADERS, Location: new URL(`/${locale}/${claims.storeKey}${IMPERSONATION_LANDING_PATH}`, request.url).toString() },
    });
  } catch (error) {
    // Only the class is logged, never a message, a token or a response body.
    console.error(`[impersonate] refused (${error instanceof Error ? error.constructor.name : typeof error})`);
    return notFound();
  }
}

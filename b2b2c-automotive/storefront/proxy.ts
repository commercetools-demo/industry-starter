// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { NextResponse, type NextRequest } from 'next/server';
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type AppLocale } from '@/i18n/config';
import { getSessionSecret } from '@/lib/env';
import { apiGate, methodGate } from '@/lib/security/api-gate';
import { decideLocale } from '@/lib/locale-redirect';
import { applyStore, SESSION_COOKIE, sessionCookieOptions, setCookieHeader, signSession, verifySession } from '@/lib/session-core';
import { endRecord, getRecordStatus } from '@/lib/ct/impersonation';
import { getStoreContext } from '@/lib/ct/stores';
import { endedSession, impersonationState, isImpersonating, touchImpersonation } from '@/lib/impersonation/state';
import type { Session } from '@/lib/types';

/** The payment return URL registered with the hosted Checkout has no locale and no store (workstream O). */
const isCheckoutReturn = (pathname: string) => pathname === '/checkout/return' || pathname === '/checkout/return/';

/** The portal posts the "Shop as customer" hand-off form across origins; its single-use signed token is the credential (workstream V-06). */
const CROSS_ORIGIN_EXEMPT = ['/api/impersonate'] as const;

/** Segments after the locale that are Malva pages, never a store key (a seed test pins that no store uses one). */
const RESERVED_SEGMENTS: ReadonlySet<string> = new Set(['categories']);

const sameStoreFields = (a: Session, b: Session) =>
  a.storeKey === b.storeKey &&
  a.distributionChannelId === b.distributionChannelId &&
  a.supplyChannelId === b.supplyChannelId &&
  a.productSelectionId === b.productSelectionId &&
  a.cartId === b.cartId &&
  a.branchKey === b.branchKey;

/** Locale step, then store resolution: the first segment after the locale is the store key. */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isCheckoutReturn(pathname)) return NextResponse.next();
  // Workstream X: every state-changing /api call must be same-origin JSON or multipart before any handler runs.
  if (pathname.startsWith('/api/')) {
    const refused = apiGate(request, pathname, CROSS_ORIGIN_EXEMPT);
    return refused ? new NextResponse(refused.body, refused) : NextResponse.next();
  }
  // G09: pages answer GET, HEAD and POST (Server Actions) only; TRACE, PUT, PATCH, DELETE are 405.
  const badMethod = methodGate(request.method);
  if (badMethod) return new NextResponse(null, badMethod);

  const decision = decideLocale({
    pathname,
    search,
    cookieLocale: request.cookies.get(LOCALE_COOKIE)?.value,
    nodeEnv: process.env.NODE_ENV,
  });

  switch (decision.kind) {
    case 'skip':
    case 'passUnsupported':
      return NextResponse.next();
    case 'redirect':
      return NextResponse.redirect(new URL(decision.location, request.url), 307);
    case 'pass': {
      const headers = new Headers(request.headers);
      headers.set('x-next-intl-locale', decision.locale);
      headers.delete('x-store-key'); // never trust a client supplied value
      // The path of this request for server layouts, which do not know it (the account guard returns the shopper here after sign-in; `safeNext` checks it).
      headers.set('x-pathname', `${pathname}${search}`);
      const finish = (response: NextResponse) => {
        if (decision.setCookie) {
          response.cookies.set(LOCALE_COOKIE, decision.locale, { maxAge: LOCALE_COOKIE_MAX_AGE, path: '/', sameSite: 'lax' });
        }
        return response;
      };

      const storeKey = pathname.split('/')[2];
      // `/de-DE` alone is the Malva home and `/de-DE/categories/...` a Malva listing: no store lookup, no session write.
      if (!storeKey || RESERVED_SEGMENTS.has(storeKey)) return finish(NextResponse.next({ request: { headers } }));
      return finish(await resolveStore(request, decision.locale, storeKey, headers));
    }
  }
}

async function resolveStore(request: NextRequest, locale: AppLocale, storeKey: string, headers: Headers): Promise<NextResponse> {
  let store;
  try {
    store = await getStoreContext(storeKey);
  } catch {
    // An outage is never a 404; getStoreContext already served a stale entry when it had one.
    return new NextResponse('Service unavailable', { status: 503 });
  }
  if (!store) {
    // The store-not-found page calls notFound(), so no catalogue data is touched (`/{locale}` is the Malva home now).
    return NextResponse.rewrite(new URL(`/${locale}/store-not-found`, request.url), { status: 404, request: { headers } });
  }

  const secret = getSessionSecret();
  let session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value, secret);
  // "Shop as customer" (V-06): every page request renews the idle deadline, and an expired or revoked session ends here (the cookie is rewritten).
  let impersonationChanged = false;
  if (isImpersonating(session)) {
    const now = new Date();
    const state = impersonationState(session, now, session.impJti ? await getRecordStatus(session.impJti) : undefined);
    if (state === 'expired') {
      if (session.impJti) await endRecord(session.impJti);
      session = endedSession(session, crypto.randomUUID());
    } else {
      session = touchImpersonation(session, now);
    }
    impersonationChanged = true;
  }
  const next = applyStore(session, store);
  headers.set('x-store-key', store.storeKey);
  const changed = impersonationChanged || !sameStoreFields(session, next);
  let token: string | undefined;
  if (changed) {
    token = await signSession(next, secret);
    // Server Components of this very request must see the new store too.
    headers.set('cookie', setCookieHeader(headers.get('cookie'), SESSION_COOKIE, token));
  }
  const response = NextResponse.next({ request: { headers } });
  if (token) response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}

// Skips Next internals, files with an extension and the locale-less payment return URL; API routes only get the origin gate (workstream X).
export const config = { matcher: ['/((?!_next|api|checkout/return|.*\\..*).*)', '/', '/api/:path*'] };

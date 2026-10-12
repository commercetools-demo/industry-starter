// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { NextResponse, type NextRequest } from 'next/server';
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type AppLocale } from '@/i18n/config';
import { getSessionSecret } from '@/lib/env';
import { decideLocale } from '@/lib/locale-redirect';
import { applyStore, SESSION_COOKIE, sessionCookieOptions, setCookieHeader, signSession, verifySession } from '@/lib/session-core';
import { getStoreContext } from '@/lib/ct/stores';
import type { Session } from '@/lib/types';

/** The payment return URL registered with the hosted Checkout has no locale and no store (workstream O). */
const isCheckoutReturn = (pathname: string) => pathname === '/checkout/return' || pathname === '/checkout/return/';

const sameStoreFields = (a: Session, b: Session) =>
  a.storeKey === b.storeKey &&
  a.distributionChannelId === b.distributionChannelId &&
  a.supplyChannelId === b.supplyChannelId &&
  a.productSelectionId === b.productSelectionId &&
  a.cartId === b.cartId;

/** Locale step, then store resolution: the first segment after the locale is the store key. */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isCheckoutReturn(pathname)) return NextResponse.next();

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
      const finish = (response: NextResponse) => {
        if (decision.setCookie) {
          response.cookies.set(LOCALE_COOKIE, decision.locale, { maxAge: LOCALE_COOKIE_MAX_AGE, path: '/', sameSite: 'lax' });
        }
        return response;
      };

      const storeKey = pathname.split('/')[2];
      // `/de-DE` alone: the locale page answers 404 (no dealer locator), no lookup.
      if (!storeKey) return finish(NextResponse.next({ request: { headers } }));
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
    // The locale page calls notFound(), so no catalogue data is touched.
    return NextResponse.rewrite(new URL(`/${locale}`, request.url), { status: 404, request: { headers } });
  }

  const secret = getSessionSecret();
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value, secret);
  const next = applyStore(session, store);
  headers.set('x-store-key', store.storeKey);
  const changed = !sameStoreFields(session, next);
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

// Skips Next internals, API routes, files with an extension, and the locale-less payment return URL.
export const config = { matcher: ['/((?!_next|api|checkout/return|.*\\..*).*)', '/'] };

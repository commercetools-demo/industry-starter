// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { NextResponse, type NextRequest } from 'next/server';
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from '@/i18n/config';
import { decideLocale } from '@/lib/locale-redirect';

// Locale step only. Store-context resolution is added by workstreams G and I after this step.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
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
      const response = NextResponse.next({ request: { headers } });
      if (decision.setCookie) {
        response.cookies.set(LOCALE_COOKIE, decision.locale, { maxAge: LOCALE_COOKIE_MAX_AGE, path: '/', sameSite: 'lax' });
      }
      return response;
    }
  }
}

export const config = { matcher: ['/((?!_next|api|.*\\..*).*)', '/'] };

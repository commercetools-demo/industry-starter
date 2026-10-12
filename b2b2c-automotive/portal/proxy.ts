import { NextResponse, type NextRequest } from 'next/server';
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type AppLocale } from '@/i18n/config';
import { getSessionSecret } from '@/lib/env';
import { decideLocale } from '@/lib/locale-redirect';
import { isAuthRoute, sanitizeNext } from '@/lib/next-path';
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/session-core';

/** `/de-DE/catalog/x?y=1` -> `/catalog/x?y=1`; the locale-less path the sign-in page returns to. */
function returnPath(pathname: string, search: string, locale: AppLocale): string | undefined {
  const rest = pathname.slice(`/${locale}`.length);
  if (rest === '' || rest === '/') return undefined;
  return sanitizeNext(`${rest}${search}`);
}

/**
 * Locale step first (bare `/` goes to the cookie locale, else de-DE), then the session step: a signed-out visitor
 * on any route outside the auth routes goes to `/{locale}/sign-in?next=<validated path>`; a signed-in user on the
 * sign-in page goes home. The signed-in test is a verified session cookie with a `customerId` (a reduced pending
 * session counts; the portal layout sends it to the pending page). Pages and handlers still check the session themselves.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const decision = decideLocale({
    pathname,
    search,
    cookieLocale: request.cookies.get(LOCALE_COOKIE)?.value,
    nodeEnv: process.env.NODE_ENV ?? 'development',
  });

  switch (decision.kind) {
    case 'skip':
    case 'passUnsupported':
      return NextResponse.next();
    case 'redirect':
      return NextResponse.redirect(new URL(decision.location, request.url));
    case 'pass': {
      const { locale } = decision;
      const withLocaleCookie = <R extends NextResponse>(response: R): R => {
        if (decision.setCookie) {
          response.cookies.set(LOCALE_COOKIE, locale, { maxAge: LOCALE_COOKIE_MAX_AGE, path: '/', sameSite: 'lax' });
        }
        return response;
      };

      const session = await verifySession(request.cookies.get(SESSION_COOKIE_NAME)?.value, getSessionSecret());
      const signedIn = Boolean(session.customerId);
      const first = pathname.split('/')[2];

      if (!signedIn && !isAuthRoute(first)) {
        const next = returnPath(pathname, search, locale);
        const location = `/${locale}/sign-in${next ? `?next=${encodeURIComponent(next)}` : ''}`;
        return withLocaleCookie(NextResponse.redirect(new URL(location, request.url)));
      }
      if (signedIn && !session.pending && first === 'sign-in') {
        return withLocaleCookie(NextResponse.redirect(new URL(`/${locale}`, request.url)));
      }

      const headers = new Headers(request.headers);
      headers.set('x-next-intl-locale', locale);
      return withLocaleCookie(NextResponse.next({ request: { headers } }));
    }
  }
}

export const config = { matcher: ['/((?!_next|api|.*\\..*).*)', '/'] };

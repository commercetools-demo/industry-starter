import { NextResponse, type NextRequest } from 'next/server';
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from '@/i18n/config';
import { decideLocale } from '@/lib/locale-redirect';

export function proxy(request: NextRequest) {
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
      const headers = new Headers(request.headers);
      headers.set('x-next-intl-locale', decision.locale);
      const response = NextResponse.next({ request: { headers } });
      if (decision.setCookie) {
        response.cookies.set(LOCALE_COOKIE, decision.locale, { maxAge: LOCALE_COOKIE_MAX_AGE, path: '/', sameSite: 'lax' });
      }
      // R adds the authenticated redirect to sign-in after the locale step.
      return response;
    }
  }
}

export const config = { matcher: ['/((?!_next|api|.*\\..*).*)', '/'] };

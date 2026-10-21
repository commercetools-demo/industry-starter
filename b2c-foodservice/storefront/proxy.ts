import { NextRequest, NextResponse } from 'next/server';
import { COUNTRY_CONFIG, DEFAULT_LOCALE, LOCALE_COOKIE } from '@/lib/utils';

const LOCALES = Object.keys(COUNTRY_CONFIG);
const LOCALE_HEADER = 'x-next-intl-locale';
// A first path segment shaped like a locale, for example fr-FR or de.
const LOCALE_SHAPE = /^[a-z]{2}(-[A-Z]{2})?$/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/api/') ||
    pathname === '/api' ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const [, first = '', ...rest] = pathname.split('/');

  if (LOCALES.includes(first)) {
    // Forward on the request too, so server components read the locale (next-intl).
    const headers = new Headers(request.headers);
    headers.set(LOCALE_HEADER, first);
    const response = NextResponse.next({ request: { headers } });
    response.headers.set(LOCALE_HEADER, first);
    return response;
  }

  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = cookie && LOCALES.includes(cookie) ? cookie : DEFAULT_LOCALE.locale;

  // An unsupported locale-shaped first segment is replaced, never nested.
  const segments = LOCALE_SHAPE.test(first) ? rest : [first, ...rest];
  const tail = segments.join('/');

  const url = request.nextUrl.clone();
  url.pathname = tail ? `/${locale}/${tail}` : `/${locale}`;
  return NextResponse.redirect(url, 307);
}

export const config = {
  matcher: ['/((?!api|_next|favicon|.*\\..*).*)', '/'],
};

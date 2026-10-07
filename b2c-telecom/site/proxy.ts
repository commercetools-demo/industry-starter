import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_LOCALE, isSupportedLocale, LOCALES, MARKET_COOKIE, MARKET_COOKIE_MAX_AGE } from '@/lib/utils';

// Hand-written (not next-intl's createMiddleware): its Accept-Language detection would override the market cookie.
export const config = {
  matcher: ['/((?!api|_next|dev|favicon|.*\\..*).*)', '/'],
};

function marketCookieOptions() {
  return {
    path: '/',
    maxAge: MARKET_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  };
}

function urlLocale(pathname: string) {
  return LOCALES.find((locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`));
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const cookieValue = request.cookies.get(MARKET_COOKIE)?.value;
  const locale = urlLocale(pathname);

  if (locale) {
    const headers = new Headers(request.headers);
    headers.set('x-next-intl-locale', locale);
    headers.set('x-pathname', pathname);
    const response = NextResponse.next({ request: { headers } });
    if (cookieValue !== locale) {
      response.cookies.set(MARKET_COOKIE, locale, marketCookieOptions());
    }
    return response;
  }

  const target = isSupportedLocale(cookieValue) ? cookieValue : DEFAULT_LOCALE;
  const path = pathname === '/' ? '' : pathname;
  const url = request.nextUrl.clone();
  url.pathname = `/${target}${path}`;
  url.search = search;
  return NextResponse.redirect(url, 307);
}

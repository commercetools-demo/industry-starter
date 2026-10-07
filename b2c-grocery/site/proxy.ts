import { NextResponse, type NextRequest } from 'next/server';
import { COUNTRY_CONFIG, DEFAULT_LOCALE, LOCALE_COOKIE } from '@/lib/utils';

// Hand-written on purpose: next-intl's createMiddleware would let Accept-Language override our cookie rule.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const first = pathname.split('/')[1] ?? '';

  if (first in COUNTRY_CONFIG) {
    const headers = new Headers(request.headers);
    headers.set('x-next-intl-locale', first);
    headers.set('x-pathname', pathname);
    return NextResponse.next({ request: { headers } });
  }

  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = cookie && cookie in COUNTRY_CONFIG ? cookie : DEFAULT_LOCALE.locale;
  const target = pathname === '/' ? `/${locale}` : `/${locale}${pathname}`;
  return NextResponse.redirect(new URL(`${target}${search}`, request.url), 307);
}

export const config = { matcher: ['/((?!api|_next|favicon|.*\\..*).*)', '/'] };

import { NextResponse, type NextRequest } from 'next/server';
import { PATH_HEADER } from '@/lib/site';
import { DEFAULT_LOCALE, isSupportedLocale, LOCALE_COOKIE } from '@/lib/utils';

/** Looks like a locale prefix (`xx-XX`), supported or not. An unsupported one is left for the layout to answer with not-found. */
const LOCALE_SHAPE = /^[a-z]{2}-[A-Z]{2}$/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split('/')[1] ?? '';
  if (LOCALE_SHAPE.test(first)) {
    // The portal layout needs the requested path (without the locale) to build the sign-in return link.
    const headers = new Headers(request.headers);
    headers.set(PATH_HEADER, `${pathname.slice(first.length + 1) || '/'}${request.nextUrl.search}`);
    return NextResponse.next({ request: { headers } });
  }

  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isSupportedLocale(cookie) ? cookie : DEFAULT_LOCALE;
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url);
}

// API, framework internals and anything with a file extension are never rewritten.
export const config = { matcher: ['/((?!api|_next|favicon|.*\\..*).*)', '/'] };

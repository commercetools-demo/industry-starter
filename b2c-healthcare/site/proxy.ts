import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isSupportedLocale } from '@/lib/utils';

const intlMiddleware = createMiddleware(routing);

// Looks like a BCP-47 region locale such as fr-FR (two or three letters, dash, region/script).
const LOCALE_SHAPE = /^[a-z]{2,3}-[a-z]{2,4}$/i;

/**
 * Next 16 `proxy` (formerly middleware). Every page lives under /<locale>/...:
 * - supported prefix: pass through next-intl (sets the request locale header and cookie);
 * - unprefixed path: redirect to the cookie locale when valid, otherwise the default locale;
 * - unsupported prefix such as /fr-FR/x: redirect to the same path under the default/cookie locale,
 *   so a page never mixes languages.
 */
export default function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const [, first = '', ...rest] = pathname.split('/');

  if (isSupportedLocale(first)) return intlMiddleware(request) as NextResponse;

  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isSupportedLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
  const remainder = LOCALE_SHAPE.test(first) ? rest.join('/') : [first, ...rest].join('/');

  const target = request.nextUrl.clone();
  target.pathname = `/${locale}${remainder ? `/${remainder}` : ''}`;
  target.search = search;
  return NextResponse.redirect(target);
}

export const config = {
  matcher: ['/((?!api|_next|favicon|.*\\..*).*)', '/'],
};

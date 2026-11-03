import { NextRequest, NextResponse } from 'next/server';
import { instoreRedirect, isInstore } from '@/lib/app-mode';
import { BRAND_HEADER, DEFAULT_BRAND, isBrandSlug } from '@/lib/brands';
import { reconcileMarket } from '@/lib/session-reconcile';
import { COUNTRY_CONFIG, DEFAULT_LOCALE, LOCALE_COOKIE } from '@/lib/utils';

const LOCALES = Object.keys(COUNTRY_CONFIG);
const LOCALE_HEADER = 'x-next-intl-locale';

/**
 * Only a page load may move the session to the market of the URL. A background fetch (next/link prefetch, soft navigation)
 * must have no side effect: without this a market switch with a bag lost the bag, because links of the old market in the page
 * were prefetched after the switch and the answer to that prefetch moved the session back and dropped the cart (found by Q
 * in journey J6). Next removes its own prefetch headers before the proxy runs, so the proxy reads what the browser sends:
 * `Sec-Fetch-Dest` is `document` for a page load and `empty` for a fetch. A client that sends neither (curl, an old browser)
 * keeps the old behaviour.
 */
function mayWriteCookies(request: NextRequest): boolean {
  const h = request.headers;
  if (/prefetch/i.test(h.get('sec-purpose') ?? '') || h.get('purpose') === 'prefetch') return false;
  const dest = h.get('sec-fetch-dest');
  return dest === null || dest === 'document' || dest === 'iframe';
}
// A first path segment shaped like a locale, for example fr-FR or de.
const LOCALE_SHAPE = /^[a-z]{2}(-[A-Z]{2})?$/;

export async function proxy(request: NextRequest) {
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

  const [, maybeBrand = '', ...afterBrand] = pathname.split('/');

  // Multibrand (design D2): the URL is `/{brand}/{locale}/...`. A path without a brand is a legacy or default URL and goes to the
  // default brand: `/` and `/{locale}/...` become `/malva-coffee/{locale}/...` (308, path and query kept).
  if (!isBrandSlug(maybeBrand)) {
    const url = request.nextUrl.clone();
    const [firstLegacy = '', ...restLegacy] = [maybeBrand, ...afterBrand];
    if (LOCALES.includes(firstLegacy)) {
      const tail = restLegacy.join('/');
      url.pathname = tail ? `/${DEFAULT_BRAND}/${firstLegacy}/${tail}` : `/${DEFAULT_BRAND}/${firstLegacy}`;
      return NextResponse.redirect(url, 308);
    }
    const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
    const locale = cookie && LOCALES.includes(cookie) ? cookie : DEFAULT_LOCALE.locale;
    // An unsupported locale-shaped first segment is replaced, never nested.
    const segments = LOCALE_SHAPE.test(firstLegacy) ? restLegacy : [firstLegacy, ...restLegacy].filter(Boolean);
    const tail = segments.join('/');
    url.pathname = tail ? `/${DEFAULT_BRAND}/${locale}/${tail}` : `/${DEFAULT_BRAND}/${locale}`;
    return NextResponse.redirect(url, 307);
  }

  const brand = maybeBrand;
  const [first = '', ...rest] = afterBrand;

  if (LOCALES.includes(first)) {
    // In-store companion (workstream R, D-048): content, account, journal, search and shop paths go to the companion's home;
    // `/category/x` and `/cart` go to their in-store pages. Decided before any session work. The companion is Malva Coffee only.
    if (isInstore()) {
      if (brand !== DEFAULT_BRAND) {
        const url = request.nextUrl.clone();
        url.pathname = `/${DEFAULT_BRAND}/${first}`;
        url.search = '';
        return NextResponse.redirect(url, 307);
      }
      const to = instoreRedirect(rest.length ? `/${rest.join('/')}` : '');
      if (to !== null) {
        const url = request.nextUrl.clone();
        url.pathname = to === '/' ? `/${brand}/${first}` : `/${brand}/${first}${to}`;
        if (to === '/') url.search = '';
        return NextResponse.redirect(url, 307);
      }
    }
    // The URL locale is the source of truth for the market: a session or market cookie in another market is rewritten
    // here, on the request too so the page renders in the URL market (FIX-2, Q-F-15).
    const reconciled = await reconcileMarket(
      first,
      request.cookies.get('malva-session')?.value,
      request.cookies.get(LOCALE_COOKIE)?.value,
    );
    for (const c of reconciled?.cookies ?? []) request.cookies.set(c.name, c.value);
    // Forward on the request too, so server components read the locale (next-intl) and the brand.
    const headers = new Headers(request.headers);
    headers.set(LOCALE_HEADER, first);
    headers.set(BRAND_HEADER, brand);
    const response = NextResponse.next({ request: { headers } });
    response.headers.set(LOCALE_HEADER, first);
    // The render of a background fetch still sees the URL market through the request cookies above; only a page load writes them.
    for (const c of mayWriteCookies(request) ? (reconciled?.cookies ?? []) : []) {
      response.cookies.set(c.name, c.value, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: c.maxAge,
        secure: process.env.NODE_ENV === 'production',
      });
    }
    return response;
  }

  // A brand without a valid locale: use the market cookie (or the default) and keep the rest of the path.
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = cookie && LOCALES.includes(cookie) ? cookie : DEFAULT_LOCALE.locale;
  // An unsupported locale-shaped segment after the brand is replaced, never nested.
  const segments = LOCALE_SHAPE.test(first) ? rest : [first, ...rest].filter(Boolean);
  const tail = segments.join('/');
  const url = request.nextUrl.clone();
  url.pathname = tail ? `/${brand}/${locale}/${tail}` : `/${brand}/${locale}`;
  return NextResponse.redirect(url, 307);
}

export const config = {
  matcher: ['/((?!api|_next|favicon|gate|checkout/return|.*\\..*).*)', '/'],
};

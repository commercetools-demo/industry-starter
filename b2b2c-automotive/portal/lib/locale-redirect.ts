import { DEFAULT_LOCALE_KEY, isAppLocale, LOCALES, type AppLocale } from '@/i18n/config';

export type LocaleDecision =
  | { kind: 'skip' }
  | { kind: 'redirect'; location: string } // 307
  | { kind: 'pass'; locale: AppLocale; setCookie: boolean }
  | { kind: 'passUnsupported' }; // the locale layout answers 404

const SKIP_EXACT = new Set(['/favicon.ico', '/robots.txt', '/sitemap.xml']);

function shouldSkip(pathname: string, nodeEnv: string): boolean {
  if (SKIP_EXACT.has(pathname)) return true;
  if (pathname === '/api' || pathname.startsWith('/api/')) return true;
  if (pathname === '/_next' || pathname.startsWith('/_next/')) return true;
  if (/\.[A-Za-z0-9]+$/.test(pathname.split('/').pop() ?? '')) return true;
  if (nodeEnv !== 'production' && (pathname === '/dev' || pathname.startsWith('/dev/'))) return true;
  return false;
}

/** Pure locale step of the proxy: bare path goes to the cookie locale (else de-DE); no Accept-Language detection. */
export function decideLocale(input: { pathname: string; search: string; cookieLocale?: string; nodeEnv: string }): LocaleDecision {
  const { pathname, search, cookieLocale, nodeEnv } = input;
  if (shouldSkip(pathname, nodeEnv)) return { kind: 'skip' };

  const [, first = '', ...rest] = pathname.split('/');
  if (/^[a-z]{2}-[a-z]{2}$/i.test(first)) {
    if (isAppLocale(first)) return { kind: 'pass', locale: first, setCookie: cookieLocale !== first };
    const canonical = LOCALES.find((l) => l.toLowerCase() === first.toLowerCase());
    if (canonical) {
      const tail = rest.length ? `/${rest.join('/')}` : '';
      return { kind: 'redirect', location: `/${canonical}${tail}${search}` };
    }
    return { kind: 'passUnsupported' };
  }
  const locale = isAppLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE_KEY;
  return { kind: 'redirect', location: `/${locale}${pathname === '/' ? '' : pathname}${search}` };
}

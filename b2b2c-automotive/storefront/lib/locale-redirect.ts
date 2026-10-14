// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Pure locale decision for the proxy: no Next imports, so it is unit-testable.
import { DEFAULT_LOCALE_KEY, isAppLocale, LOCALES, type AppLocale } from '@/i18n/config';

export type LocaleDecision =
  | { kind: 'skip' }
  | { kind: 'redirect'; location: string }
  | { kind: 'pass'; locale: AppLocale; setCookie: boolean }
  | { kind: 'passUnsupported' };

const LOCALE_SHAPE = /^[a-z]{2}-[a-z]{2}$/i;
const STATIC_FILES = new Set(['/favicon.ico', '/robots.txt', '/sitemap.xml']);

function shouldSkip(pathname: string, nodeEnv: string): boolean {
  if (pathname === '/api' || pathname.startsWith('/api/')) return true;
  if (pathname === '/_next' || pathname.startsWith('/_next/')) return true;
  if (STATIC_FILES.has(pathname)) return true;
  if (/\.[^/]+$/.test(pathname)) return true;
  // Dev specimen pages live outside [locale]; they answer notFound() in production.
  return nodeEnv !== 'production' && (pathname === '/dev' || pathname.startsWith('/dev/'));
}

/**
 * Bare path: cookie locale if supported, else de-DE (no Accept-Language detection).
 * Locale-shaped first segment: supported passes, wrong case redirects to canonical case, unsupported passes so the layout 404s.
 */
export function decideLocale(input: { pathname: string; search: string; cookieLocale?: string; nodeEnv: string }): LocaleDecision {
  const { pathname, search, cookieLocale, nodeEnv } = input;
  if (shouldSkip(pathname, nodeEnv)) return { kind: 'skip' };

  const [, first = '', ...rest] = pathname.split('/');
  if (LOCALE_SHAPE.test(first)) {
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

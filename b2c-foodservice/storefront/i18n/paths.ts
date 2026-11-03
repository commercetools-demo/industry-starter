// Pure path helpers of the brand-aware navigation (no React, usable on the server and in tests).
import { BRAND_SLUGS, type BrandSlug } from '@/lib/brands';
import { COUNTRY_CONFIG } from '@/lib/utils';

const LOCALES = Object.keys(COUNTRY_CONFIG);
const isExternal = (href: string): boolean => !href.startsWith('/') || href.startsWith('//');

/** Splits `path?query#hash` so only the path is prefixed. */
function split(href: string): { path: string; rest: string } {
  const cut = href.search(/[?#]/);
  return cut === -1 ? { path: href, rest: '' } : { path: href.slice(0, cut), rest: href.slice(cut) };
}

/** `/p/x?y=1` becomes `/{brand}/{locale}/p/x?y=1`; `/` becomes `/{brand}/{locale}`. External, hash-only and query-only hrefs pass through. A path already under a brand and locale is kept. */
export function withBrandAndLocale(href: string, brand: BrandSlug, locale: string): string {
  if (isExternal(href)) return href;
  const { path, rest } = split(href);
  const [, first = '', second = ''] = path.split('/');
  if ((BRAND_SLUGS as readonly string[]).includes(first) && LOCALES.includes(second)) return href;
  const prefix = `/${brand}/${locale}`;
  return `${path === '/' ? prefix : `${prefix}${path}`}${rest}`;
}

/** The inverse for a browser pathname: `/malva-drinks/en-US/c/chic` becomes `/c/chic`, a home page becomes `/`. */
export function stripBrandAndLocale(pathname: string): string {
  const [, first = '', second = '', ...rest] = pathname.split('/');
  if (!(BRAND_SLUGS as readonly string[]).includes(first) || !LOCALES.includes(second)) return pathname || '/';
  return rest.length ? `/${rest.join('/')}` : '/';
}

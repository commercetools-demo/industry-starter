import { SUPPORTED_LOCALES } from '@/lib/utils';

// `?next=` is user-controlled input. Only a path inside this site that starts with a supported
// locale segment (for example `/en-US/cart`) may be used as a post-sign-in destination.

const ORIGIN = 'http://sanitize.invalid';

/**
 * Returns `raw` normalized (path, query, hash) when it is a same-origin locale path, otherwise `fallback`.
 * Rejected: absolute and protocol-relative URLs, other schemes, backslashes, control characters,
 * `//` anywhere in the path (it would become protocol-relative once the locale is stripped),
 * paths that leave the locale after dot-segment normalization, and unsupported locales.
 */
export function sanitizeNext(raw: string | null | undefined, fallback: string | null = null): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2000) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  for (const char of raw) {
    const code = char.charCodeAt(0);
    if (char === '\\' || code <= 0x1f || code === 0x7f) return fallback;
  }
  let url: URL;
  try {
    url = new URL(raw, ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== ORIGIN) return fallback;
  const [, locale] = url.pathname.split('/');
  if (!SUPPORTED_LOCALES.some((supported) => supported === locale)) return fallback;
  if (url.pathname.includes('//')) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Splits a sanitized locale path into its locale and the locale-less path (`/` for the home page). */
export function splitLocalePath(path: string): { locale: string; path: string } | null {
  const clean = sanitizeNext(path);
  if (!clean) return null;
  const match = /^\/([^/?#]+)(\/[^?#]*)?(.*)$/.exec(clean);
  if (!match) return null;
  const [, locale, rest = '', tail = ''] = match;
  return { locale, path: `${rest || '/'}${tail}` };
}

/** Builds the `next` value for a sign-in link from the active locale and the locale-less pathname. */
export function toNextParam(locale: string, pathname: string): string {
  const path = pathname === '/' ? '' : pathname;
  return `/${locale}${path}`;
}

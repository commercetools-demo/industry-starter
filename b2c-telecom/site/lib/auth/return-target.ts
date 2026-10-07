// Pure (client-safe). The return target after sign-in: a same-site path, never a host (open-redirect guard).
import { RETURN_SEGMENTS } from '@/lib/config/auth';
import { isSupportedLocale, type Market } from '@/lib/utils';

type Locale = Market['locale'];

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const MAX_LENGTH = 512;

/** `/en-US/bundle?x=1` -> `{ locale: 'en-US', rest: '/bundle?x=1' }`; no locale prefix -> locale undefined. */
function splitLocale(path: string): { locale: string | undefined; rest: string } {
  const match = /^\/([^/?#]+)(.*)$/.exec(path);
  const head = match?.[1];
  if (match && head !== undefined && isSupportedLocale(head)) return { locale: head, rest: match[2] === '' ? '/' : (match[2] as string) };
  return { locale: undefined, rest: path };
}

/** Removes a leading locale segment: the locale-aware router adds its own. */
export function stripLocalePrefix(path: string): string {
  const { locale, rest } = splitLocale(path);
  return locale === undefined ? path : rest;
}

/** `<path>?returnTo=<encoded>` when there is a target (links between the auth pages carry it along). */
export function withReturnTo(path: string, returnTo: string | undefined): string {
  return returnTo ? `${path}?returnTo=${encodeURIComponent(returnTo)}` : path;
}

/**
 * The locale-prefixed path to go to after sign-in. Accepted: a path starting with "/" (not "//"), with no backslash, no scheme,
 * no control character and no `..` segment, optionally already prefixed with THIS locale, whose first segment is one of
 * `RETURN_SEGMENTS`. Anything else returns `/<locale>/account`. The result never contains a host.
 */
export function safeReturnPath(input: string | null | undefined, locale: Locale): string {
  const fallback = `/${locale}/account`;
  if (typeof input !== 'string' || input.length === 0 || input.length > MAX_LENGTH) return fallback;
  if (!input.startsWith('/') || input.startsWith('//')) return fallback;
  if (input.includes('\\') || input.includes('://') || CONTROL_CHARACTERS.test(input)) return fallback;
  const { locale: given, rest } = splitLocale(input);
  if (given !== undefined && given !== locale) return fallback;
  if (!rest.startsWith('/') || rest.startsWith('//')) return fallback;
  const segments = rest.split(/[?#]/, 1)[0]?.split('/') ?? [];
  if (segments.some((segment) => segment === '..' || segment === '.' || /^%2e/i.test(segment))) return fallback;
  const first = segments[1] ?? '';
  if (!(RETURN_SEGMENTS as readonly string[]).includes(first)) return fallback;
  return `/${locale}${rest}`;
}

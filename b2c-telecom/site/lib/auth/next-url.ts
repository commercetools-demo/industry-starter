// Pure helpers (safe in client code). `lib/auth/guards.ts` re-exports them next to the server-only `requireSession`.
import type { Locale } from '@/lib/types';

export const DEFAULT_NEXT = '/account';
const MAX_NEXT_LENGTH = 512;
const REFERENCE_PATTERN = /^[A-Za-z0-9-]{4,32}$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/**
 * The destination after sign-in as a same-site path: one leading "/", at most 512 characters, no "//", no backslash,
 * no scheme or host, no control characters. Anything else returns "/account" (open-redirect guard).
 */
export function sanitizeNext(next: string | null | undefined): string {
  if (typeof next !== 'string' || next.length === 0 || next.length > MAX_NEXT_LENGTH) return DEFAULT_NEXT;
  if (!next.startsWith('/') || next.startsWith('//')) return DEFAULT_NEXT;
  if (next.includes('\\') || CONTROL_CHARACTERS.test(next)) return DEFAULT_NEXT;
  return next;
}

/** `/{locale}/login?next=<encoded destination>`. */
export function loginUrl(locale: Locale, destination: string): string {
  return `/${locale}/login?next=${encodeURIComponent(sanitizeNext(destination))}`;
}

export function isSafeReference(reference: string | null | undefined): reference is string {
  return typeof reference === 'string' && REFERENCE_PATTERN.test(reference);
}

/** `/{locale}/unauthorized`, plus `?ref=` only when the reference matches the safe pattern. */
export function unauthorizedUrl(locale: Locale, reference?: string): string {
  return isSafeReference(reference) ? `/${locale}/unauthorized?ref=${reference}` : `/${locale}/unauthorized`;
}

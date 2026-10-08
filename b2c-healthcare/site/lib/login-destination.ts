import { sanitizeNext, splitLocalePath } from '@/lib/next-path';
import { reasonForPath, type AuthReason } from '@/lib/sign-in-reason';

export const DEFAULT_DESTINATION = '/account';

export interface LoginDestination {
  /** Locale-less path to land on after signing in. */
  path: string;
  /** Locale taken from a valid `next`, undefined for the default destination. */
  locale?: string;
  reason: AuthReason | null;
}

/**
 * Turns the raw `?next=` query value into a safe destination. Only a same-site locale path survives
 * (`sanitizeNext`); a missing, malformed, external, protocol-relative or repeated value gives `/account`.
 * The sign-in page itself is never a destination (it would loop).
 */
export function resolveLoginDestination(raw: string | string[] | undefined): LoginDestination {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const clean = sanitizeNext(value);
  const split = clean ? splitLocalePath(clean) : null;
  if (!split || split.path === '/login' || split.path.startsWith('/login/') || split.path.startsWith('/login?')) {
    return { path: DEFAULT_DESTINATION, reason: null };
  }
  return { path: split.path, locale: split.locale, reason: reasonForPath(split.path) };
}

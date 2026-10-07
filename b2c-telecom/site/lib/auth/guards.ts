import 'server-only';
import { redirect } from '@/i18n/routing';
import { getSession } from '@/lib/ct/session';
import type { Locale } from '@/lib/types';
import { sanitizeNext } from './next-url';

export { sanitizeNext, loginUrl, unauthorizedUrl } from './next-url';

/**
 * Top of every signed-in page (S, T): no customer in the session (never signed in, or the cookie expired) redirects to
 * sign-in with the destination preserved. It is NOT a refusal, so it never goes to /unauthorized.
 * `redirect` throws: never call this inside try/catch.
 */
export async function requireSession(locale: Locale, destination: string): Promise<{ customerId: string }> {
  const session = await getSession();
  if (!session.customerId) {
    return redirect({ href: `/login?next=${encodeURIComponent(sanitizeNext(destination))}`, locale });
  }
  return { customerId: session.customerId };
}

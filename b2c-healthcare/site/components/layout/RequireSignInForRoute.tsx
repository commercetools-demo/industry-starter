'use client';
import { usePathname } from '@/i18n/routing';
import { reasonForPath } from '@/lib/sign-in-reason';
import { RequireSignIn } from './RequireSignIn';

/**
 * `RequireSignIn` for a layout that does not know which route it guards: the reason line is derived from the
 * current path (`/cart` gives the cart reason, anything unlisted the account one) and the prompt links to
 * sign-in with that same path as `next`.
 */
export function RequireSignInForRoute() {
  const pathname = usePathname();
  return <RequireSignIn reason={reasonForPath(pathname) ?? 'account'} />;
}

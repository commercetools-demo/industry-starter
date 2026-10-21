import 'server-only';
import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { requireCustomer } from '@/lib/api';
import { safeRedirect } from '@/lib/auth/redirect';
import { getSession } from '@/lib/session';

/**
 * Page-side guard. A guest is sent to the sign-in page with the (locale-free) path to come back to; a signed-in
 * shopper gets `{ customerId }`. `redirect()` throws, so never call this inside try/catch.
 */
export async function requireCustomerPage(currentPath: string): Promise<{ customerId: string }> {
  const { customerId } = await getSession();
  if (customerId) return { customerId };
  const back = safeRedirect(currentPath, '/account');
  redirect({ href: `/account/sign-in?redirect=${encodeURIComponent(back)}`, locale: await getLocale() });
  throw new Error('unreachable: redirect() throws');
}

/** API-side guard: D's `requireCustomer()`, which throws `AppError('unauthorized', 401)` with no detail. */
export const requireCustomerApi = requireCustomer;

import 'server-only';
import { ApiError } from '@/lib/api-error';
import { redirect } from '@/i18n/routing';
import { getCustomerById, sessionsValidAfterOf } from '@/lib/ct/customer';
import { getSession } from '@/lib/ct/session';
import type { SessionData } from '@/lib/session-types';
import type { Locale } from '@/lib/types';
import { safeReturnPath } from './return-target';

// The guards of every account page (S, T, V) and every /api/account/* route. There is no layout-level guard: layouts do not re-run on
// client navigation. D-070: the customer id always comes from the signed session.

/** The commercetools customer as lib/ct/customer.ts returns it (this file never imports the SDK). */
type CtCustomer = NonNullable<Awaited<ReturnType<typeof getCustomerById>>>;

export interface CustomerContext {
  session: SessionData & { customerId: string };
  customer: CtCustomer;
}

/**
 * A session is valid while the customer exists and the session was signed in at or after the customer's `sessionsValidAfter` (set by a
 * password reset). A session without `signedInAt` (older than this field) is invalid once a cut-off exists.
 */
export function isSessionValid(session: SessionData, customer: CtCustomer | null): customer is CtCustomer {
  if (!customer) return false;
  const cutOff = sessionsValidAfterOf(customer);
  if (cutOff === undefined) return true;
  const signedInAt = Number(session.signedInAt);
  return Number.isFinite(signedInAt) && signedInAt >= cutOff;
}

async function load(): Promise<{ session: SessionData; customer: CtCustomer | null }> {
  const session = await getSession();
  if (!session.customerId) return { session, customer: null };
  return { session, customer: await getCustomerById(session.customerId) };
}

/**
 * Top of a signed-in page: anonymous, unknown or invalidated sessions go to `/<locale>/login?returnTo=<path>` (a redirect, never
 * /unauthorized). `redirect` throws: never call this inside try/catch. Returns the session and the customer read fresh (uncached).
 */
export async function requireCustomerPage(locale: Locale, path: string): Promise<CustomerContext> {
  const { session, customer } = await load();
  if (!session.customerId || !isSessionValid(session, customer)) {
    return redirect({ href: `/login?returnTo=${encodeURIComponent(safeReturnPath(path, locale))}`, locale });
  }
  return { session: { ...session, customerId: session.customerId }, customer };
}

/** The route-handler variant: throws `ApiError` 401 UNAUTHENTICATED (answer it with `Cache-Control: no-store`). */
export async function requireCustomerApi(): Promise<CustomerContext> {
  const { session, customer } = await load();
  if (!session.customerId || !isSessionValid(session, customer)) throw new ApiError('UNAUTHENTICATED', 'Sign in required');
  return { session: { ...session, customerId: session.customerId }, customer };
}

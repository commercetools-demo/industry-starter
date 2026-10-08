import 'server-only';
import { getCustomerByIdCached } from '@/lib/ct/customers';
import { getSession } from '@/lib/session';
import type { AccountUser } from '@/lib/types';

/**
 * The signed-in user for the header avatar, resolved from the session on every request (the cookie
 * carries ids only, so the name is read once per request through the cached customer read).
 * An expired or invalid session gives null (anonymous). If commercetools is unavailable the user
 * is returned with the id only: the header stays signed in and shows a neutral avatar.
 */
export async function getHeaderUser(): Promise<AccountUser | null> {
  const session = await getSession();
  if (!session.customerId) return null;
  try {
    return (await getCustomerByIdCached(session.customerId)) ?? null;
  } catch {
    return { id: session.customerId };
  }
}

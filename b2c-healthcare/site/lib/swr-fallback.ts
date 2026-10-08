import 'server-only';
import { KEY_ACCOUNT, KEY_CART } from '@/lib/cache-keys';
import { getActiveCartSafe } from '@/lib/ct/cart-read';
import { getSession } from '@/lib/session';
import type { AccountUser, CartSummary } from '@/lib/types';

export type SwrFallback = Record<string, CartSummary | AccountUser | null>;

/**
 * Initial SWR state for the root layout, built from the session only: `KEY_CART` when `cartId`
 * exists (a stale cart yields null and the page still renders) and a minimal `KEY_ACCOUNT` user
 * with the id only. The display name is NOT here; pages that show it call getCustomerByIdCached.
 * Everything returned is serializable.
 */
export async function getSwrFallback(): Promise<SwrFallback> {
  const session = await getSession();
  const fallback: SwrFallback = {};
  if (session.cartId) fallback[KEY_CART] = await getActiveCartSafe(session.cartId);
  if (session.customerId) fallback[KEY_ACCOUNT] = { id: session.customerId };
  return fallback;
}

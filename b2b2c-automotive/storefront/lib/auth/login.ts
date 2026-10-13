// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `loginCustomer`: the one server function behind the sign-in form and the demo login (workstream Q reuses it). It signs the shopper in at
// the store (anonymous cart merged, D8), writes `customerId` and the merged `cartId` into the session cookie and runs the sign-in hooks
// (garage merge). No password or token is stored. Throws `AuthError` for bad credentials (one failure for every reason).
import 'server-only';
import { runSignInHooks } from '@/lib/auth';
import { signIn } from '@/lib/ct/auth';
import { endedSession } from '@/lib/impersonation/state';
import { mapCustomer } from '@/lib/mappers/customer';
import { createRateLimiter } from '@/lib/rate-limit';
import { getSession, updateSession } from '@/lib/session';
import type { AccountCustomer } from '@/lib/types';

export { AuthError } from '@/lib/ct/auth';

// Per server instance and client address: ten attempts in fifteen minutes (protects the customer store, not a security boundary).
export const loginLimiter = createRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 });

export const clientKey = (request: Request): string => request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

export interface LoginResult {
  customer: AccountCustomer;
  /** Units in the cart after the merge (0 without a cart). */
  count: number;
}

export async function loginCustomer(input: { storeKey: string; email: string; password: string }): Promise<LoginResult> {
  const session = await getSession();
  const { customer, cart } = await signIn({ ...input, anonymousCartId: session.cartId, anonymousId: session.anonymousId });
  await updateSession((s) => {
    const next = { ...endedSession(s), customerId: customer.id }; // a sign-in ends a shop-as session (V-06)
    if (cart) next.cartId = cart.id;
    else delete next.cartId;
    return next;
  });
  await runSignInHooks({ session, customerId: customer.id });
  return { customer: mapCustomer(customer), count: (cart?.lineItems ?? []).reduce((sum, line) => sum + line.quantity, 0) };
}

import 'server-only';
import { NextResponse } from 'next/server';
import type { Cart as CtCart, Customer as CtCustomer } from '@commercetools/platform-sdk';
import { jsonError } from './cart-api';
import { clientKey, rateLimit, LIMITS } from './rate-limit';
import { updateSession } from './session';

export type SessionUser = { id: string; email: string; firstName: string; lastName: string };

export const userOf = (customer: CtCustomer): SessionUser => ({
  id: customer.id,
  email: customer.email,
  firstName: customer.firstName ?? '',
  lastName: customer.lastName ?? '',
});

/**
 * First thing every auth route does (E-09). Returns the 429 response when blocked, else `null`.
 * Never echoes which limit or key was hit.
 */
export function blockedByRateLimit(request: Request, route: keyof typeof LIMITS): NextResponse | null {
  const result = rateLimit(clientKey(request, `auth:${route}`), LIMITS[route]);
  if (result.ok) return null;
  const res = jsonError('RATE_LIMITED', 429);
  res.headers.set('Retry-After', String(result.retryAfterSeconds));
  return res;
}

/**
 * The shopper is now this customer: write the identity fields and the merged cart id (or drop the cart id when the
 * sign-in produced no Active cart, so a stale anonymous cart is never kept). Responds `{ user }`.
 */
export async function signedInJson(customer: CtCustomer, cart?: CtCart): Promise<NextResponse> {
  const res = NextResponse.json({ user: userOf(customer) });
  await updateSession(
    {
      customerId: customer.id,
      customerEmail: customer.email,
      customerFirstName: customer.firstName,
      customerLastName: customer.lastName,
      cartId: cart && cart.cartState === 'Active' ? cart.id : undefined,
    },
    res,
  );
  return res;
}

export const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

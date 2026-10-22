import { handle } from '@/lib/api';
import { domainError } from '@/lib/api-domain';
import { GUEST_EMAIL_COOKIE } from '@/lib/auth/guest-email';
import { isEmailShape } from '@/lib/auth/email-shape';
import { isCredentialFailure, limitRegister, signedInResponse } from '@/lib/auth/login-flow';
import { validatePassword } from '@/lib/auth/password-policy';
import { createCustomer, signIn } from '@/lib/ct/auth';
import { getMarket, getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const text = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max ? v.trim() : null;

/**
 * POST /api/auth/register { email, password, firstName, lastName } -> 201 { customer, cart } and a session cookie.
 * The customer is created verified (D-032, no email) and signed in at once, which also merges the guest cart.
 * 422 password_policy { failed } before any commercetools call; 409 registration_failed is generic (Q-J-05).
 */
export const POST = handle('/api/auth/register', async (req) => {
  const raw: unknown = await req.json().catch(() => null);
  const input = (raw ?? {}) as Record<string, unknown>;
  const email = text(input.email, 254);
  const firstName = text(input.firstName, 100);
  const lastName = text(input.lastName, 100);
  const password = typeof input.password === 'string' ? input.password : null;
  if (!email || !isEmailShape(email) || !firstName || !lastName || password === null) {
    return domainError('invalid_request', 400);
  }
  const limited = limitRegister(req);
  if (limited) return limited;

  const policy = validatePassword(password, email);
  if (!policy.ok) return domainError('password_policy', 422, { failed: policy.failed });

  const [session, market] = await Promise.all([getSession(), getMarket()]);
  try {
    await createCustomer({ email, password, firstName, lastName, locale: market.locale });
  } catch (e) {
    // A duplicate address and any other rejected input read the same: no hint whether the email is registered.
    if (isCredentialFailure(e)) return domainError('registration_failed', 409);
    throw e;
  }
  const result = await signIn(email, password, { cartId: session.cartId, anonymousId: session.anonymousId });
  const res = await signedInResponse(result, session, 201);
  // The guest-order email prefill (set by checkout) has done its job; only a route can remove the cookie.
  res.cookies.set(GUEST_EMAIL_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0, secure: process.env.NODE_ENV === 'production' });
  return res;
});

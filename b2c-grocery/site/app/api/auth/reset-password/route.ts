import { NextResponse } from 'next/server';
import { blockedByRateLimit, isNonEmptyString, signedInJson } from '@/lib/auth-api';
import { jsonError, readJson } from '@/lib/cart-api';
import { InvalidTokenError, resetPassword, signIn } from '@/lib/ct/auth';
import { getSession } from '@/lib/session';

const MIN_PASSWORD_LENGTH = 8;

/** Sets the new password with the token, signs the customer in (anonymous cart merged) and answers `{ ok: true }`. */
export async function POST(request: Request): Promise<NextResponse> {
  const blocked = blockedByRateLimit(request, 'reset');
  if (blocked) return blocked;

  const { token, password } = await readJson(request);
  if (!isNonEmptyString(token)) return jsonError('INVALID_TOKEN', 400);
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) return jsonError('WEAK_PASSWORD', 400);

  let email: string;
  try {
    email = (await resetPassword(token, password)).email;
  } catch (e) {
    if (e instanceof InvalidTokenError) return jsonError('INVALID_TOKEN', 400);
    console.error('Password reset failed', e instanceof Error ? e.message : e);
    return jsonError('RESET_ERROR', 500);
  }

  try {
    const session = await getSession();
    const { customer, cart } = await signIn(email, password, session.cartId);
    return await signedInJson(customer, cart, { ok: true });
  } catch (e) {
    // The password was changed; signing in is a convenience. The shopper can sign in by hand.
    console.error('Sign-in after reset failed', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: true });
  }
}

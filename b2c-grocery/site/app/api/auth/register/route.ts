import { NextResponse } from 'next/server';
import { blockedByRateLimit, isNonEmptyString, signedInJson } from '@/lib/auth-api';
import { jsonError, readJson } from '@/lib/cart-api';
import { AccountExistsError, signIn, signUp } from '@/lib/ct/auth';
import { getSession } from '@/lib/session';

const MIN_PASSWORD_LENGTH = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** D-038: the customer is verified server-side (inside `signUp`); no email is sent and no mail module exists. */
export async function POST(request: Request): Promise<NextResponse> {
  const blocked = blockedByRateLimit(request, 'register');
  if (blocked) return blocked;

  const body = await readJson(request);
  const { firstName, lastName, email, password } = body;
  if (!isNonEmptyString(firstName) || !isNonEmptyString(lastName) || typeof email !== 'string' || !EMAIL.test(email.trim())) {
    return jsonError('INVALID_INPUT', 400);
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) return jsonError('WEAK_PASSWORD', 400);

  try {
    await signUp({ email: email.trim(), password, firstName: firstName.trim(), lastName: lastName.trim() });
    const session = await getSession();
    const { customer, cart } = await signIn(email.trim(), password, session.cartId);
    return await signedInJson(customer, cart);
  } catch (e) {
    if (e instanceof AccountExistsError) return jsonError('ACCOUNT_EXISTS', 409);
    console.error('Registration failed', e instanceof Error ? e.message : e);
    return jsonError('REGISTER_ERROR', 500);
  }
}

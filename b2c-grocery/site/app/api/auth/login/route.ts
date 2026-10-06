import { NextResponse } from 'next/server';
import { blockedByRateLimit, isNonEmptyString, signedInJson } from '@/lib/auth-api';
import { jsonError, readJson } from '@/lib/cart-api';
import { InvalidCredentialsError, signIn } from '@/lib/ct/auth';
import { getSession } from '@/lib/session';

/** Identical body for unknown email, wrong password and any other failure: the response must never reveal which. */
const invalid = (): NextResponse => jsonError('INVALID_CREDENTIALS', 401);

export async function POST(request: Request): Promise<NextResponse> {
  const blocked = blockedByRateLimit(request, 'login');
  if (blocked) return blocked;

  const body = await readJson(request);
  if (!isNonEmptyString(body.email) || !isNonEmptyString(body.password)) return invalid();

  try {
    const session = await getSession();
    const { customer, cart } = await signIn(body.email.trim(), body.password, session.cartId);
    return await signedInJson(customer, cart);
  } catch (e) {
    if (!(e instanceof InvalidCredentialsError)) console.error('Sign-in failed', e instanceof Error ? e.message : e);
    return invalid();
  }
}

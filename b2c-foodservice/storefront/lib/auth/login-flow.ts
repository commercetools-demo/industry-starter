import 'server-only';
import { NextResponse } from 'next/server';
import { domainError } from '@/lib/api-domain';
import { sessionFromLogin } from '@/lib/auth/session-customer';
import { signIn, type SignInResult } from '@/lib/ct/auth';
import { toAppCustomer, toAuthCart } from '@/lib/mappers/customer';
import { hashKey, rateLimit } from '@/lib/rate-limit';
import { createSessionToken, setSessionCookie, type Session } from '@/lib/session';

const TEN_MINUTES = 10 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip') || 'unknown';
}

function tooMany(retryAfterSeconds: number): Response {
  const res = domainError('too_many_attempts', 429, { retryAfterSeconds });
  res.headers.set('Retry-After', String(retryAfterSeconds));
  return res;
}

/** 5 attempts per 10 minutes per ip and address, 30 per 10 minutes per ip. Null when allowed. */
export function limitLogin(req: Request, email: string): Response | null {
  const ip = clientIp(req);
  const perAddress = rateLimit(hashKey('login', ip, email.trim()), { limit: 5, windowMs: TEN_MINUTES });
  if (!perAddress.allowed) return tooMany(perAddress.retryAfterSeconds);
  const perIp = rateLimit(hashKey('login-ip', ip), { limit: 30, windowMs: TEN_MINUTES });
  if (!perIp.allowed) return tooMany(perIp.retryAfterSeconds);
  return null;
}

/** 5 registrations per hour per ip. Null when allowed. */
export function limitRegister(req: Request): Response | null {
  const result = rateLimit(hashKey('register-ip', clientIp(req)), { limit: 5, windowMs: ONE_HOUR });
  return result.allowed ? null : tooMany(result.retryAfterSeconds);
}

/** Wrong password, unknown address and any other 4xx look the same to the shopper. */
export function isCredentialFailure(e: unknown): boolean {
  const status = (e as { statusCode?: unknown } | null)?.statusCode;
  return status === 400 || status === 404;
}

/** Writes a fresh session cookie (new iat, fresh signature) and the customer plus merged cart as JSON. */
export async function signedInResponse(result: SignInResult, session: Session, status = 200): Promise<Response> {
  const body = {
    customer: toAppCustomer(result.customer),
    cart: result.cart ? toAuthCart(result.cart) : null,
  };
  const token = await createSessionToken(sessionFromLogin(result, session));
  return setSessionCookie(NextResponse.json(body, { status }), token);
}

/** Shared by login and demo login. Any other failure is rethrown for D's `handle()` (503 upstream_unavailable). */
export async function signInAndRespond(email: string, password: string, session: Session): Promise<Response> {
  let result: SignInResult;
  try {
    result = await signIn(email, password, { cartId: session.cartId, anonymousId: session.anonymousId });
  } catch (e) {
    if (isCredentialFailure(e)) return domainError('invalid_credentials', 401);
    throw e;
  }
  return signedInResponse(result, session);
}

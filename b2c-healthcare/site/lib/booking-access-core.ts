import { jwtVerify, SignJWT } from 'jose';

/**
 * Pure primitives of the guest booking cookie (no Next.js imports, so they are unit-testable). A guest has no
 * account, so the browser that created a booking keeps a signed list of its references in an HTTP-only cookie;
 * only a booking whose reference is in that list is shown to it. The cookie holds references only: no name,
 * email, phone or reason (health-data-minimization).
 */
export const BOOKING_COOKIE = 'malva_bk';
export const BOOKING_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;
export const MAX_BOOKING_REFS = 20;
const AUDIENCE = 'malva-booking-access';

export const BOOKING_REFERENCE = /^BK-[A-Z0-9]{10}$/;

/** Adds a reference (newest last, no duplicates) and keeps at most {@link MAX_BOOKING_REFS}. */
export function addBookingRef(refs: readonly string[], reference: string): string[] {
  if (!BOOKING_REFERENCE.test(reference)) return [...refs];
  return [...refs.filter((ref) => ref !== reference), reference].slice(-MAX_BOOKING_REFS);
}

export async function signBookingRefs(refs: readonly string[], secret: string): Promise<string> {
  return new SignJWT({ refs: refs.filter((ref) => BOOKING_REFERENCE.test(ref)).slice(-MAX_BOOKING_REFS) })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${BOOKING_COOKIE_MAX_AGE_SECONDS}s`)
    .sign(new TextEncoder().encode(secret));
}

/** A tampered, expired, foreign (for example the session token) or missing cookie gives an empty list, never an error. */
export async function verifyBookingRefs(token: string | undefined, secret: string): Promise<string[]> {
  if (!token) return [];
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'], audience: AUDIENCE });
    const refs = payload.refs;
    return Array.isArray(refs) ? refs.filter((ref): ref is string => typeof ref === 'string' && BOOKING_REFERENCE.test(ref)).slice(-MAX_BOOKING_REFS) : [];
  } catch {
    return [];
  }
}

export interface BookingCookieOptions {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: '/';
  maxAge: number;
}

/** Secure everywhere except local development (plain http://localhost). */
export function bookingCookieOptions(nodeEnv: string | undefined): BookingCookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: nodeEnv !== 'development', path: '/', maxAge: BOOKING_COOKIE_MAX_AGE_SECONDS };
}

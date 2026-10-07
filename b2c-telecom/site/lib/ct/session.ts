import 'server-only';
import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import type { SessionData } from '@/lib/session-types';
import { validateSessionSecret } from './env';

export const SESSION_COOKIE = 'malva-session';
export const SESSION_MAX_AGE_SECONDS = 2_592_000; // 30 days, fixed (not sliding)

/** The whitelist: nothing else is ever signed into the cookie. */
export const SESSION_FIELDS: readonly (keyof SessionData)[] = [
  'anonymousId',
  'customerId',
  'cartId',
  'lastOrderNumber',
  'locale',
  'country',
  'currency',
];

// Used only when NODE_ENV is 'test' and SESSION_SECRET is unset (Vitest).
const TEST_ONLY_SECRET = 'test-only-session-secret-0123456789abcdef';

function secretKey(): Uint8Array {
  const raw = process.env.SESSION_SECRET;
  const secret = process.env.NODE_ENV === 'test' && (raw === undefined || raw === '') ? TEST_ONLY_SECRET : validateSessionSecret(raw);
  return new TextEncoder().encode(secret);
}

function pick(data: SessionData): SessionData {
  const out: SessionData = {};
  for (const field of SESSION_FIELDS) {
    const value = data[field];
    if (typeof value === 'string') out[field] = value;
  }
  return out;
}

export async function createSessionToken(data: SessionData): Promise<string> {
  return new SignJWT({ ...pick(data) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function getSession(): Promise<SessionData> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return {};
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    return pick(payload as SessionData);
  } catch (error) {
    // A weak or missing secret is a configuration error, not a bad cookie.
    if (error instanceof Error && /SESSION_SECRET/.test(error.message)) throw error;
    return {};
  }
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
    secure: process.env.NODE_ENV === 'production',
  };
}

export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(SESSION_COOKIE, token, cookieOptions(SESSION_MAX_AGE_SECONDS));
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, '', cookieOptions(0));
}

/** Merge the patch into the current session, re-sign and set the cookie on the response. `undefined` deletes a field. */
export async function updateSession(patch: Partial<SessionData>, res: NextResponse): Promise<SessionData> {
  const merged: SessionData = { ...(await getSession()) };
  for (const field of SESSION_FIELDS) {
    if (!(field in patch)) continue;
    const value = patch[field];
    if (value === undefined) delete merged[field];
    else merged[field] = value;
  }
  setSessionCookie(res, await createSessionToken(merged));
  return merged;
}

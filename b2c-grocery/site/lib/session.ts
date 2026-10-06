import 'server-only';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { COUNTRY_CONFIG, DEFAULT_LOCALE, LOCALE_COOKIE } from './utils';

export interface Session {
  customerId?: string;
  customerEmail?: string;
  customerFirstName?: string;
  customerLastName?: string;
  cartId?: string;
  anonymousId?: string;
  country?: string;
  currency?: string;
  locale?: string;
}

export const SESSION_COOKIE = 'malva-session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const DEV_SECRET = 'dev-only-session-secret-0123456789ab';

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
    return new TextEncoder().encode(secret);
  }
  return new TextEncoder().encode(secret && secret.length >= 32 ? secret : DEV_SECRET);
}

export async function createSessionToken(data: Session): Promise<string> {
  return new SignJWT({ ...data })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

async function readToken(token: string): Promise<Session> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
    const session: Record<string, unknown> = { ...payload };
    delete session.iat;
    delete session.exp;
    return session as Session;
  } catch {
    return {};
  }
}

/** Empty object for no cookie, a tampered token or an expired token. */
export async function getSession(): Promise<Session> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? readToken(token) : {};
}

/** The visitor's market. Makes no commercetools call. */
export async function getMarket(): Promise<{ country: string; currency: string; locale: string }> {
  const session = await getSession();
  if (session.country && session.currency && session.locale) {
    return { country: session.country, currency: session.currency, locale: session.locale };
  }
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  const config = (cookie && COUNTRY_CONFIG[cookie]) || DEFAULT_LOCALE;
  return { country: config.country, currency: config.currency, locale: config.locale };
}

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
  maxAge: MAX_AGE_SECONDS,
});

export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(SESSION_COOKIE, token, cookieOptions());
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, '', { ...cookieOptions(), maxAge: 0 });
}

/** Merge into the current session, re-sign and set the cookie. Used by every mutating route. */
export async function updateSession(patch: Partial<Session>, res: NextResponse): Promise<Session> {
  const next: Session = { ...(await getSession()), ...patch };
  for (const key of Object.keys(next) as (keyof Session)[]) if (next[key] === undefined) delete next[key];
  setSessionCookie(res, await createSessionToken(next));
  return next;
}

import 'server-only';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { getEnv } from '@/lib/env';
import type { LocaleKey } from '@/lib/types';
import { COUNTRY_CONFIG, DEFAULT_LOCALE, LOCALE_COOKIE, isLocaleKey } from '@/lib/utils';

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
  collectionStoreKey?: string;
}

export const SESSION_COOKIE = 'malva-session';
const SESSION_MAX_AGE = 2592000; // 30 days
const MARKET_MAX_AGE = 31536000; // 1 year
const MAX_TOKEN_LENGTH = 3800;

const SESSION_KEYS = [
  'customerId',
  'customerEmail',
  'customerFirstName',
  'customerLastName',
  'cartId',
  'anonymousId',
  'country',
  'currency',
  'locale',
  'collectionStoreKey',
] as const satisfies ReadonlyArray<keyof Session>;

/** Keeps only the known keys with string values; drops anything else (tokens, card data). */
export function sanitizeSession(input: Record<string, unknown>): Session {
  const out: Session = {};
  for (const key of SESSION_KEYS) {
    const value = input[key];
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().SESSION_SECRET);
}

export async function createSessionToken(data: Session): Promise<string> {
  const token = await new SignJWT({ ...sanitizeSession({ ...data }) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secretKey());
  if (token.length > MAX_TOKEN_LENGTH) {
    throw new Error('Session token is too large for a cookie');
  }
  return token;
}

/** Any failure (missing, tampered, expired, wrong secret) gives an empty session, never an error. */
export async function verifySessionToken(token: string | undefined): Promise<Session> {
  if (!token) return {};
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    return sanitizeSession(payload as Record<string, unknown>);
  } catch {
    return {};
  }
}

export async function getSession(): Promise<Session> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function getMarket(): Promise<{ country: string; currency: string; locale: string }> {
  const session = await getSession();
  if (session.country && session.currency && session.locale) {
    return { country: session.country, currency: session.currency, locale: session.locale };
  }
  const store = await cookies();
  const chosen = store.get(LOCALE_COOKIE)?.value;
  const market = isLocaleKey(chosen) ? COUNTRY_CONFIG[chosen] : DEFAULT_LOCALE;
  return { country: market.country, currency: market.currency, locale: market.locale };
}

export function setSessionCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}

export function clearSessionCookie(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}

export function setMarketCookie(res: NextResponse, locale: LocaleKey): NextResponse {
  res.cookies.set(LOCALE_COOKIE, locale, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MARKET_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}

/** Country, currency and locale change together and the cart is dropped (a cart is bound to its market). */
export function changeMarket(session: Session, locale: LocaleKey): Session {
  const market = COUNTRY_CONFIG[locale];
  const next: Session = { ...session, country: market.country, currency: market.currency, locale: market.locale };
  delete next.cartId;
  return next;
}

export function ensureAnonymousId(session: Session): Session {
  return session.anonymousId ? session : { ...session, anonymousId: crypto.randomUUID() };
}

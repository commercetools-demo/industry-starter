import { SignJWT, jwtVerify } from 'jose';
import { COUNTRY_CONFIG, DEFAULT_LOCALE, LOCALE_COOKIE, isLocaleKey } from '@/lib/utils';

// URL locale is the source of truth for the market (FIX-2, Q-F-15, Q-G-15). The proxy calls reconcileMarket on every
// page request. This module is deliberately free of 'server-only' and next/headers so the proxy can import it; the token
// format must stay identical to lib/session.ts (a test signs with one and verifies with the other).

const SESSION_COOKIE = 'malva-session';
const SESSION_MAX_AGE = 2592000;
const MARKET_MAX_AGE = 31536000;
/** Claims lib/session.ts keeps (SESSION_KEYS). Anything else is dropped. */
const KEEP = [
  'customerId', 'customerEmail', 'customerFirstName', 'customerLastName', 'cartId', 'anonymousId', 'country',
  'currency', 'locale', 'collectionStoreKey',
] as const;

export interface CookieToSet {
  name: string;
  value: string;
  maxAge: number;
}

export interface Reconciled {
  /** Cookies the response must set (the request carries the same values, so the render sees them). */
  cookies: CookieToSet[];
}

const secretKey = () => new TextEncoder().encode(process.env.SESSION_SECRET ?? '');

/**
 * Makes the session market and the market cookie follow `urlLocale`. When the session is in another market the cart
 * and the collection store are dropped (a cart is bound to its currency, collection is US only), exactly like
 * `changeMarket` in lib/session.ts; customer fields are kept. Returns null when nothing changes. A missing, tampered
 * or expired session is left alone (never created here).
 */
export async function reconcileMarket(
  urlLocale: string,
  sessionToken: string | undefined,
  marketCookie: string | undefined,
): Promise<Reconciled | null> {
  if (!isLocaleKey(urlLocale)) return null;
  const cookies: CookieToSet[] = [];

  if (sessionToken && process.env.SESSION_SECRET) {
    try {
      const { payload } = await jwtVerify(sessionToken, secretKey(), { algorithms: ['HS256'] });
      const claims: Record<string, string> = {};
      for (const key of KEEP) {
        const value = payload[key];
        if (typeof value === 'string') claims[key] = value;
      }
      // A cart-only session has no market fields; getMarket() then uses the market cookie, so that is its market.
      const sessionMarket = claims.locale ?? (isLocaleKey(marketCookie) ? marketCookie : DEFAULT_LOCALE.locale);
      if (sessionMarket !== urlLocale) {
        const market = COUNTRY_CONFIG[urlLocale];
        delete claims.cartId;
        delete claims.collectionStoreKey;
        Object.assign(claims, { country: market.country, currency: market.currency, locale: market.locale });
        const token = await new SignJWT(claims)
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .setExpirationTime('30d')
          .sign(secretKey());
        cookies.push({ name: SESSION_COOKIE, value: token, maxAge: SESSION_MAX_AGE });
      }
    } catch {
      // Invalid session: treated as no session.
    }
  }

  if (marketCookie !== urlLocale) cookies.push({ name: LOCALE_COOKIE, value: urlLocale, maxAge: MARKET_MAX_AGE });
  return cookies.length > 0 ? { cookies } : null;
}

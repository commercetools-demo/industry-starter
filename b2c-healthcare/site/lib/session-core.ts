import { jwtVerify, SignJWT } from 'jose';
import { COUNTRY_CONFIG, isSupportedLocale } from '@/lib/utils';

/**
 * Pure session primitives (no Next.js imports) so they can be unit-tested.
 * The cookie carries ids and locale only (health-data-minimization): never a name,
 * email, date of birth, prescription or appointment.
 */
export const SESSION_COOKIE = 'malva_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const MIN_SECRET_LENGTH = 32;

export const SESSION_KEYS = ['customerId', 'cartId', 'country', 'currency', 'locale'] as const;
export type SessionKey = (typeof SESSION_KEYS)[number];
export type SessionData = Partial<Record<SessionKey, string>>;

/** Used only when NODE_ENV === 'test' and no SESSION_SECRET is set. Not a real secret. */
const TEST_ONLY_SECRET = 'test-only-session-secret-0123456789-abcdef';

/** Returns the signing secret or throws. There is no fallback key outside the test environment. */
export function resolveSecret(secret: string | undefined, nodeEnv: string | undefined): string {
  if (secret && secret.length >= MIN_SECRET_LENGTH) return secret;
  if (nodeEnv === 'test') return TEST_ONLY_SECRET;
  throw new Error(`SESSION_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters. See .env.example.`);
}

/** Keeps only the allow-listed keys with non-empty string values; everything else is dropped. */
export function pickSession(input: unknown): SessionData {
  const out: SessionData = {};
  if (typeof input !== 'object' || input === null) return out;
  const record = input as Record<string, unknown>;
  for (const key of SESSION_KEYS) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) out[key] = value;
  }
  return out;
}

export async function signSession(data: SessionData, secret: string): Promise<string> {
  return new SignJWT({ ...pickSession(data) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(new TextEncoder().encode(secret));
}

/** Tampered, expired, malformed or missing token: an empty anonymous session, never an error. */
export async function verifySession(token: string | undefined, secret: string): Promise<SessionData> {
  if (!token) return {};
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] });
    return pickSession(payload);
  } catch {
    return {};
  }
}

export interface SessionCookieOptions {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: '/';
  maxAge: number;
}

/** Secure everywhere except local development (plain http://localhost). */
export function sessionCookieOptions(nodeEnv: string | undefined): SessionCookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: nodeEnv !== 'development', path: '/', maxAge: SESSION_MAX_AGE_SECONDS };
}

/** Merge a patch; `undefined` values remove a key; unknown keys are ignored. */
export function applyPatch(current: SessionData, patch: Partial<Record<SessionKey, string | undefined>>): SessionData {
  const next: SessionData = { ...current };
  for (const key of SESSION_KEYS) {
    if (!(key in patch)) continue;
    const value = patch[key];
    if (typeof value === 'string' && value.length > 0) next[key] = value;
    else delete next[key];
  }
  return next;
}

export const withCustomer = (s: SessionData, customerId: string): SessionData => applyPatch(s, { customerId });
export const withCart = (s: SessionData, cartId: string): SessionData => applyPatch(s, { cartId });
/** Sign-out: drop customerId and cartId, keep locale, country and currency. */
export const withoutCustomer = (s: SessionData): SessionData => applyPatch(s, { customerId: undefined, cartId: undefined });
/** After an order: drop cartId only. */
export const withoutCart = (s: SessionData): SessionData => applyPatch(s, { cartId: undefined });
export const withLocale = (
  s: SessionData,
  locale: { locale: string; country?: string; currency?: string },
): SessionData => applyPatch(s, locale);

/**
 * Atomic region change: locale, country and currency are always written together, derived from
 * COUNTRY_CONFIG (never from caller-supplied country/currency). A currency change drops `cartId`
 * because the cart is priced in the previous currency. Unsupported locales throw.
 */
export function withRegion(s: SessionData, locale: string): SessionData {
  if (!isSupportedLocale(locale)) throw new Error(`Unsupported locale: ${locale}`);
  const { country, currency } = COUNTRY_CONFIG[locale];
  const patch: Partial<Record<SessionKey, string | undefined>> = { locale, country, currency };
  if (s.currency !== currency) patch.cartId = undefined;
  return applyPatch(s, patch);
}

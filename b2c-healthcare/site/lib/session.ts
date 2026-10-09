import 'server-only';
import { cookies } from 'next/headers';
import {
  SESSION_COOKIE,
  applyPatch,
  resolveSecret,
  sessionCookieOptions,
  signSession,
  verifySession,
  withCart,
  withCustomer,
  withRegion,
  withoutCart,
  withoutCustomer,
  type SessionData,
  type SessionKey,
} from '@/lib/session-core';

export type { SessionData } from '@/lib/session-core';

// Fails on first use when SESSION_SECRET is missing or short (except NODE_ENV=test): no fallback key.
// Resolved lazily so `next build` can import route modules with an empty environment.
const secret = (): string => resolveSecret(process.env.SESSION_SECRET, process.env.NODE_ENV);

/** Reads the session from the request cookie. Invalid or expired cookies yield an empty session. */
export async function getSession(): Promise<SessionData> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value, secret());
}

async function write(data: SessionData): Promise<SessionData> {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(data, secret()), sessionCookieOptions(process.env.NODE_ENV));
  return data;
}

/** Merge a patch (undefined removes a key). Only callable where cookies are writable (Route Handlers, Server Actions). */
export async function updateSession(patch: Partial<Record<SessionKey, string | undefined>>): Promise<SessionData> {
  return write(applyPatch(await getSession(), patch));
}

export async function setCustomer(customerId: string): Promise<SessionData> {
  return write(withCustomer(await getSession(), customerId));
}
export async function setCart(cartId: string): Promise<SessionData> {
  return write(withCart(await getSession(), cartId));
}
/** Sign-out: drops customerId and cartId, keeps locale fields. */
export async function clearCustomer(): Promise<SessionData> {
  return write(withoutCustomer(await getSession()));
}
/** After an order is placed. */
export async function clearCart(): Promise<SessionData> {
  return write(withoutCart(await getSession()));
}
/**
 * Atomic region switch: writes locale, country and currency together from COUNTRY_CONFIG and clears
 * `cartId` when the currency changes. Throws for a locale that is not in COUNTRY_CONFIG.
 */
export async function setLocale({ locale }: { locale: string }): Promise<SessionData> {
  return write(withRegion(await getSession(), locale));
}

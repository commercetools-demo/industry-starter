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
  withLocale,
  withoutCart,
  withoutCustomer,
  type SessionData,
  type SessionKey,
} from '@/lib/session-core';

export type { SessionData } from '@/lib/session-core';

// Fails at import when SESSION_SECRET is missing or short (except NODE_ENV=test): no fallback key.
const SECRET = resolveSecret(process.env.SESSION_SECRET, process.env.NODE_ENV);

/** Reads the session from the request cookie. Invalid or expired cookies yield an empty session. */
export async function getSession(): Promise<SessionData> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value, SECRET);
}

async function write(data: SessionData): Promise<SessionData> {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(data, SECRET), sessionCookieOptions(process.env.NODE_ENV));
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
/** Placeholder for workstream G (locale switching). */
export async function setLocale(locale: { locale: string; country?: string; currency?: string }): Promise<SessionData> {
  return write(withLocale(await getSession(), locale));
}

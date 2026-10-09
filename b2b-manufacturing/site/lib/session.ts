import 'server-only';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, cookieOptions, openSession, sealSession, secretKey, type Session } from './session-core';

export type { Session } from './session-core';
export { clearCart, clearCustomer, initDefaultStore, setBusinessContext, setCart, setCustomer } from './session-core';

const key = () => secretKey(process.env.SESSION_SECRET);

/** Fail at startup (instrumentation) rather than on the first request. */
export const assertSessionSecret = (): void => void key();

export async function getSession(locale?: string): Promise<Session> {
  const jar = await cookies();
  return openSession(jar.get(SESSION_COOKIE)?.value, key(), locale);
}

export async function saveSession(session: Session): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await sealSession(session, key()), cookieOptions());
}

export async function updateSession(change: (session: Session) => Session, locale?: string): Promise<Session> {
  const next = change(await getSession(locale));
  await saveSession(next);
  return next;
}

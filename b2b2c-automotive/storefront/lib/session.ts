// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import 'server-only';
import { cookies } from 'next/headers';
import { isAppLocale, LOCALE_COOKIE, type AppLocale } from '@/i18n/config';
import { getSessionSecret } from '@/lib/env';
import { SESSION_COOKIE, sessionCookieOptions, signSession, verifySession } from '@/lib/session-core';
import type { Session } from '@/lib/types';
import { COUNTRY_CONFIG, DEFAULT_LOCALE } from '@/lib/utils';

export { SESSION_COOKIE };

// A weak or missing secret stops the server at import. Only the test runner may continue (it supplies its own dummy secret).
let secret: Uint8Array | null = null;
try {
  secret = getSessionSecret();
} catch (error) {
  if (process.env.NODE_ENV !== 'test') throw error;
}
function key(): Uint8Array {
  if (!secret) throw new Error('SESSION_SECRET is not configured');
  return secret;
}

export async function getSession(): Promise<Session> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value, key());
}

export async function getLocale(): Promise<{ locale: AppLocale; currency: string; country: string }> {
  const session = await getSession();
  if (session.locale && session.currency && session.country) return { locale: session.locale, currency: session.currency, country: session.country };
  const jar = await cookies();
  const cookieLocale = jar.get(LOCALE_COOKIE)?.value;
  const { locale, currency, country } = isAppLocale(cookieLocale) ? COUNTRY_CONFIG[cookieLocale] : DEFAULT_LOCALE;
  return { locale, currency, country };
}

export async function createSessionToken(session: Session): Promise<string> {
  return signSession(session, key());
}

export async function setSessionCookie(session: Session): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSessionToken(session), sessionCookieOptions());
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Read, transform, write once. When `patch` throws nothing is written. */
export async function updateSession(patch: (s: Session) => Session): Promise<Session> {
  const next = patch(await getSession());
  await setSessionCookie(next);
  return next;
}

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import 'server-only';
import { cookies } from 'next/headers';
import { isAppLocale, LOCALE_COOKIE, type AppLocale } from '@/i18n/config';
import { getSessionSecret } from '@/lib/env';
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE, signSession, verifySession } from '@/lib/session-core';
import type { Session } from '@/lib/types';
import { COUNTRY_CONFIG, DEFAULT_LOCALE } from '@/lib/utils';

export const SESSION_COOKIE = SESSION_COOKIE_NAME;

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

/** The verified session from the cookie; `{}` for a missing, tampered or expired cookie. */
export async function getSession(): Promise<Session> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value, key());
}

/** Session triple, else the locale cookie, else de-DE. */
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

/** HTTP-only, SameSite lax, path /, Secure in production, 30 days. */
export async function setSessionCookie(session: Session): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSessionToken(session), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Read, transform, write once. When `patch` throws nothing is written. Returns the new session. */
export async function updateSession(patch: (s: Session) => Session): Promise<Session> {
  const next = patch(await getSession());
  await setSessionCookie(next);
  return next;
}

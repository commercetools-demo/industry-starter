// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Pure session logic shared by the proxy and the Node layer: no `server-only`, no env access, no `next/*` imports.
// The secret is always a parameter. Exempt from check-server-only (see scripts/check-server-only.mjs).
import { jwtVerify, SignJWT } from 'jose';
import { isAppLocale, type AppLocale } from '@/i18n/config';
import type { Session, StoreContext } from '@/lib/types';
import { COUNTRY_CONFIG } from '@/lib/utils';

export type { StoreContext } from '@/lib/types';

export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
export const SESSION_COOKIE = 'malva_session';

/** Cookie attributes for the session cookie; the proxy and `lib/session.ts` use the same ones. */
export function sessionCookieOptions(nodeEnv: string | undefined = process.env.NODE_ENV) {
  return { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: nodeEnv === 'production', maxAge: SESSION_MAX_AGE };
}

/** The allow-list: the only keys a session ever holds. Extend together with the `Session` interface. */
export const SESSION_KEYS = [
  'customerId',
  'cartId',
  'locale',
  'currency',
  'country',
  'storeKey',
  'distributionChannelId',
  'supplyChannelId',
  'productSelectionId',
  'branchKey',
  'anonymousId',
  'impersonatedBy',
  'impJti',
] as const satisfies readonly (keyof Session)[];

/** Numeric session keys (epoch seconds of an impersonation session). */
export const SESSION_NUMBER_KEYS = ['impImpExp', 'impAbs'] as const satisfies readonly (keyof Session)[];

const STRING_KEYS = SESSION_KEYS.filter((k) => k !== 'locale');

/** Keeps only allow-listed keys holding a non-empty string (locale: a supported locale). */
export function pickSession(input: unknown): Session {
  if (typeof input !== 'object' || input === null) return {};
  const source = input as Record<string, unknown>;
  const out: Session = {};
  for (const key of STRING_KEYS) {
    const value = source[key];
    if (typeof value === 'string' && value.length > 0 && value.length <= 256) out[key] = value;
  }
  for (const key of SESSION_NUMBER_KEYS) {
    const value = source[key];
    if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) out[key] = value;
  }
  if (isAppLocale(source.locale)) out.locale = source.locale;
  return out;
}

export async function signSession(session: Session, secret: Uint8Array): Promise<string> {
  return new SignJWT({ ...pickSession(session) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret);
}

/** An empty session for a missing, tampered, expired or wrongly signed token. Never throws. */
export async function verifySession(token: string | undefined, secret: Uint8Array): Promise<Session> {
  if (!token) return {};
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    return pickSession(payload);
  } catch {
    return {};
  }
}

/** Sets locale, currency and country together; `cartId` is dropped when the currency changes. */
export function applyLocale(session: Session, locale: AppLocale): Session {
  const { currency, country } = COUNTRY_CONFIG[locale];
  const next: Session = { ...session, locale, currency, country };
  if (session.currency !== currency) delete next.cartId;
  return next;
}

/** Writes the four store fields in one value (throws on an empty field, changes nothing); `cartId` and `branchKey` are dropped when the store changes. */
export function applyStore(session: Session, ctx: StoreContext): Session {
  const { storeKey, distributionChannelId, supplyChannelId, productSelectionId } = ctx;
  for (const [name, value] of Object.entries({ storeKey, distributionChannelId, supplyChannelId, productSelectionId })) {
    if (typeof value !== 'string' || value.length === 0) throw new Error(`Incomplete store context: ${name} is empty`);
  }
  const next: Session = { ...session, storeKey, distributionChannelId, supplyChannelId, productSelectionId };
  if (session.storeKey !== storeKey) {
    delete next.cartId;
    delete next.branchKey;
  }
  return next;
}

/** Replaces or adds one cookie in a `Cookie` request header (the proxy forwards a fresh session to the same request). */
export function setCookieHeader(header: string | null, name: string, value: string): string {
  const parts = (header ?? '')
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean);
  const kept = parts.filter((p) => p.split('=')[0]?.trim() !== name);
  return [...kept, `${name}=${value}`].join('; ');
}

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Pure session logic shared by the proxy and the Node layer: no `server-only`, no env access, no `next/*` imports.
// The secret is always a parameter. Exempt from check-server-only (see scripts/check-server-only.mjs).
import { jwtVerify, SignJWT } from 'jose';
import { isAppLocale, type AppLocale } from '@/i18n/config';
import type { BusinessContext, Session, StoreContext } from '@/lib/types';
import { COUNTRY_CONFIG } from '@/lib/utils';

export type { BusinessContext, StoreContext } from '@/lib/types';

export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
/** The cookie name; `lib/session.ts` re-exports it as `SESSION_COOKIE` and the proxy reads it from here. */
export const SESSION_COOKIE_NAME = 'malva_portal_session';

/** The allow-list: the only keys a session ever holds. Extend together with the `Session` interface. */
export const SESSION_KEYS = [
  'customerId',
  'businessUnitKey',
  'storeKey',
  'distributionChannelId',
  'supplyChannelId',
  'productSelectionId',
  'accountGroupIds',
  'cartId',
  'locale',
  'currency',
  'country',
  'pending',
  'actingAs',
] as const satisfies readonly (keyof Session)[];

type StringKey = Exclude<(typeof SESSION_KEYS)[number], 'locale' | 'accountGroupIds' | 'pending'>;
const STRING_KEYS = SESSION_KEYS.filter((k): k is StringKey => k !== 'locale' && k !== 'accountGroupIds' && k !== 'pending');
const MAX_FIELD = 256;
const MAX_GROUPS = 50;

/** Keeps only allow-listed keys holding the right primitive (non-empty strings, a supported locale, `pending: true`, string ids). */
export function pickSession(input: unknown): Session {
  if (typeof input !== 'object' || input === null) return {};
  const source = input as Record<string, unknown>;
  const out: Session = {};
  for (const key of STRING_KEYS) {
    const value = source[key];
    if (typeof value === 'string' && value.length > 0 && value.length <= MAX_FIELD) out[key] = value;
  }
  if (isAppLocale(source.locale)) out.locale = source.locale;
  if (source.pending === true) out.pending = true;
  const groups = source.accountGroupIds;
  if (Array.isArray(groups) && groups.length <= MAX_GROUPS && groups.every((g) => typeof g === 'string' && g.length > 0 && g.length <= MAX_FIELD)) {
    out.accountGroupIds = [...groups] as string[];
  }
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

function assertFilled(fields: Record<string, unknown>, what: string): void {
  for (const [name, value] of Object.entries(fields)) {
    if (typeof value !== 'string' || value.length === 0) throw new Error(`Incomplete ${what}: ${name} is empty`);
  }
}

/** Writes the four store fields in one value (throws on an empty field, changes nothing); `cartId` is dropped when the store changes. */
export function applyStore(session: Session, ctx: StoreContext): Session {
  const { storeKey, distributionChannelId, supplyChannelId, productSelectionId } = ctx;
  assertFilled({ storeKey, distributionChannelId, supplyChannelId, productSelectionId }, 'store context');
  const next: Session = { ...session, storeKey, distributionChannelId, supplyChannelId, productSelectionId };
  if (session.storeKey !== storeKey) delete next.cartId;
  return next;
}

/**
 * Writes the five business-unit and store fields in one value (throws on an empty field, changes nothing).
 * `cartId` is always cleared: a cart belongs to one unit and store. A pending flag from a reduced session is dropped.
 */
export function applyBusinessContext(session: Session, ctx: BusinessContext): Session {
  const { businessUnitKey, storeKey, distributionChannelId, supplyChannelId, productSelectionId, accountGroupIds } = ctx;
  assertFilled({ businessUnitKey, storeKey, distributionChannelId, supplyChannelId, productSelectionId }, 'business context');
  if (!Array.isArray(accountGroupIds) || accountGroupIds.some((g) => typeof g !== 'string' || g.length === 0)) {
    throw new Error('Incomplete business context: accountGroupIds is invalid');
  }
  const next: Session = {
    ...session,
    businessUnitKey,
    storeKey,
    distributionChannelId,
    supplyChannelId,
    productSelectionId,
    accountGroupIds: [...accountGroupIds],
  };
  delete next.cartId;
  delete next.pending;
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

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Pure rules of the "Shop as customer" session (workstream V-06, D4): no `server-only`, no env, no `next/*`, so the proxy, route handlers and
// tests share them. The deadlines live in the signed session cookie: idle limit of 120 s (renewed on every request) and an absolute cap of
// 30 minutes. A seller whose handoff record was ended in the portal is ended too (`recordStatus`).
import type { AccountCustomer, Session } from '@/lib/types';

/** The portal's constants (`portal/lib/impersonation/token.ts`), kept equal. */
export const IDLE_SECONDS = 120;
export const ABSOLUTE_SECONDS = 30 * 60;

const seconds = (now: Date): number => Math.floor(now.getTime() / 1000);

export const isImpersonating = (session: Session): boolean => typeof session.impersonatedBy === 'string' && session.impersonatedBy.length > 0;

/**
 * `none` for a normal session; else `active` or `expired`. Expired: the idle deadline or the absolute cap passed, a deadline is missing
 * (an impersonation session is never open ended), or the handoff record is `ended`.
 */
export function impersonationState(session: Session, now: Date, recordStatus?: string): 'none' | 'active' | 'expired' {
  if (!isImpersonating(session)) return 'none';
  if (recordStatus === 'ended') return 'expired';
  const t = seconds(now);
  if (typeof session.impImpExp !== 'number' || typeof session.impAbs !== 'number') return 'expired';
  return t < session.impImpExp && t < session.impAbs ? 'active' : 'expired';
}

/** Starts the session of `customerId`: the old cart (anonymous or another customer's) is dropped; the store fields stay. */
export function startImpersonation(session: Session, who: { customerId: string; actorId: string; jti: string }, now: Date): Session {
  const next: Session = { ...session, customerId: who.customerId, impersonatedBy: who.actorId, impJti: who.jti };
  delete next.cartId;
  next.impAbs = seconds(now) + ABSOLUTE_SECONDS;
  next.impImpExp = Math.min(seconds(now) + IDLE_SECONDS, next.impAbs);
  return next;
}

/** Renews the idle deadline (never beyond the absolute cap). A normal session is returned as it is. */
export function touchImpersonation(session: Session, now: Date): Session {
  if (!isImpersonating(session) || typeof session.impAbs !== 'number') return session;
  return { ...session, impImpExp: Math.min(seconds(now) + IDLE_SECONDS, session.impAbs) };
}

/** The shopper is signed out: no customer, no cart (it is the customer's), none of the impersonation fields, and `anonymousId` when given (a fresh one is written with the cookie). */
export function endedSession(session: Session, anonymousId?: string): Session {
  const next: Session = { ...session, ...(anonymousId ? { anonymousId } : {}) };
  for (const key of ['customerId', 'cartId', 'impersonatedBy', 'impJti', 'impImpExp', 'impAbs'] as const) delete next[key];
  return next;
}

/** What a seller sees of the customer while shopping as them (masked data rule): masked e-mail, no phone and no addresses; the names stay for the banner. */
export function maskAccountCustomer(customer: AccountCustomer): AccountCustomer {
  return { ...customer, email: maskEmail(customer.email), mobile: null, addresses: [], defaultShippingAddressId: null, defaultBillingAddressId: null };
}

/** The same rule for the profile read of the account area: masked e-mail and no phone. */
export function maskAccountProfile<T extends { email: string; mobile: string | null }>(profile: T): T {
  return { ...profile, email: maskEmail(profile.email), mobile: null };
}

/** `anna.beispiel@example.de` becomes `a***@e***.de` (same rule as the portal's lists). */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1 || at === email.length - 1) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const tld = dot > 0 ? domain.slice(dot) : '';
  const label = dot > 0 ? domain.slice(0, dot) : domain;
  return `${local[0]}***@${label[0] ?? ''}***${tld}`;
}

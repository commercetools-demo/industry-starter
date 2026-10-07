import 'server-only';
import { ApiError } from '@/lib/api-error';
import type { SessionData, SessionKind, SessionSummary } from '@/lib/session-types';

export function sessionKind(s: SessionData): SessionKind {
  if (s.customerId) return 'customer';
  if (s.anonymousId || s.cartId) return 'anonymous';
  return 'none';
}

export function requireCustomer(s: SessionData): string {
  if (!s.customerId) throw new ApiError('UNAUTHENTICATED', 'Sign in required');
  return s.customerId;
}

export function ensureAnonymousId(s: SessionData): { anonymousId: string; created: boolean } {
  if (s.anonymousId) return { anonymousId: s.anonymousId, created: false };
  return { anonymousId: crypto.randomUUID(), created: true };
}

/** What the browser may know: the kind, the customer id and whether a cart exists. Nothing else. */
export function toSummary(s: SessionData): SessionSummary {
  const kind = sessionKind(s);
  return {
    kind,
    ...(kind === 'customer' ? { customerId: s.customerId } : {}),
    hasCart: Boolean(s.cartId),
  };
}

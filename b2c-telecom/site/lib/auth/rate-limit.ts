// Rate limits and the per-email sign-in lockout. In memory, per server instance (best effort on serverless; accepted risk, README).
// The per-IP windows reuse E's fixed-window limiter; the lockout is consecutive failures, so it has its own store.
import { LOGIN_LOCKOUT } from '@/lib/config/auth';

export { rateLimit } from '@/lib/rate-limit';

type Failures = { count: number; lastAt: number };

const store = (globalThis as { __malvaLoginFailures?: Map<string, Failures> }).__malvaLoginFailures ?? new Map<string, Failures>();
(globalThis as { __malvaLoginFailures?: Map<string, Failures> }).__malvaLoginFailures = store;

function current(key: string, now: number): Failures | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (now - entry.lastAt >= LOGIN_LOCKOUT.windowMs) {
    store.delete(key);
    return undefined;
  }
  return entry;
}

/** Counts one failed sign-in for this (normalized) email string. Unknown emails are counted the same way. */
export function registerFailure(key: string, now: number = Date.now()): void {
  const entry = current(key, now);
  store.set(key, { count: (entry?.count ?? 0) + 1, lastAt: now });
}

/** A success resets the counter. */
export function clearFailures(key: string): void {
  store.delete(key);
}

/** Locked after `maxFailures` consecutive failures, until `windowMs` after the last one. */
export function isLockedOut(key: string, now: number = Date.now()): { locked: boolean; retryAfterSeconds: number } {
  const entry = current(key, now);
  if (!entry || entry.count < LOGIN_LOCKOUT.maxFailures) return { locked: false, retryAfterSeconds: 0 };
  return { locked: true, retryAfterSeconds: Math.max(1, Math.ceil((entry.lastAt + LOGIN_LOCKOUT.windowMs - now) / 1000)) };
}

/** Test helper. */
export function resetLockoutsForTests(): void {
  store.clear();
}

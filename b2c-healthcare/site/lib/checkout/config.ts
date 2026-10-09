/**
 * Checkout configuration. Same-day delivery: offered only before the cut-off, New York
 * time, and only where the platform's matching-cart answer contains the method (zone NY/TX/IL). The cut-off is
 * enforced here, not in commercetools.
 */

export const SAME_DAY_TIME_ZONE = 'America/New_York';
/** Same-day orders must be placed before this local time (24-hour clock in `SAME_DAY_TIME_ZONE`). */
export const SAME_DAY_CUTOFF = { hour: 14, minute: 0 } as const;

/** Shipping method keys of the seed (`scripts/seed/data/shipping.ts`). */
export const STANDARD_METHOD_KEY = 'mlv-standard';
export const SAME_DAY_METHOD_KEY = 'mlv-same-day';

/** Order number prefix and padding: `MLV-000042`. */
export const ORDER_NUMBER_PREFIX = 'MLV-';
export const ORDER_NUMBER_DIGITS = 6;

/** The initial order state (seed state key). */
export const ORDER_STATE_RECEIVED = 'mlv-received';

/** Minutes since midnight of `now` in New York (DST-aware). */
export function newYorkMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: SAME_DAY_TIME_ZONE, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get('hour') * 60 + get('minute');
}

/** True while the same-day cut-off has not passed (strictly before 14:00 New York time). */
export function isBeforeSameDayCutoff(now: Date): boolean {
  return newYorkMinutes(now) < SAME_DAY_CUTOFF.hour * 60 + SAME_DAY_CUTOFF.minute;
}

/**
 * "Now" for the cut-off decision. `SAME_DAY_NOW_OVERRIDE` (an ISO instant) exists only to demonstrate both sides of
 * the cut-off in development; it is ignored when NODE_ENV is `production`.
 */
export function checkoutNow(env: Record<string, string | undefined> = process.env, real: Date = new Date()): Date {
  const override = env.SAME_DAY_NOW_OVERRIDE?.trim();
  if (!override || env.NODE_ENV === 'production') return real;
  const parsed = new Date(override);
  return Number.isNaN(parsed.getTime()) ? real : parsed;
}

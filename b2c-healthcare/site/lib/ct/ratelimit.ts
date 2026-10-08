import 'server-only';
import { CONTAINERS, getObject, putObject, statusOf } from '@/lib/ct/custom-objects';

/** Failed prescription lookups: 5 per 10 minutes per customer, kept in `malva-ratelimit` with optimistic concurrency. */
export const RATE_LIMIT = { maxFailures: 5, windowMs: 10 * 60 * 1000 } as const;

interface Entry { /** epoch ms of each failed lookup inside the window */ failures: number[] }

export interface RateLimitStatus {
  limited: boolean;
  remaining: number;
  /** Seconds until a failure leaves the window; 0 when not limited. */
  retryAfterSeconds: number;
}

const keyOf = (customerId: string) => `rl-${customerId.replace(/[^-_~.a-zA-Z0-9]/g, '_')}`;
const MAX_ATTEMPTS = 6;

const recent = (e: Entry | undefined, now: number): number[] => (e?.failures ?? []).filter((t) => now - t < RATE_LIMIT.windowMs && t <= now);

function statusOfFailures(failures: number[], now: number): RateLimitStatus {
  const limited = failures.length >= RATE_LIMIT.maxFailures;
  const oldest = Math.min(...failures);
  return {
    limited,
    remaining: Math.max(0, RATE_LIMIT.maxFailures - failures.length),
    retryAfterSeconds: limited ? Math.ceil((oldest + RATE_LIMIT.windowMs - now) / 1000) : 0,
  };
}

/** Whether the customer may attempt another lookup right now. Read-only. */
export async function getRateLimitStatus(customerId: string, now: Date = new Date()): Promise<RateLimitStatus> {
  const stored = await getObject<Entry>(CONTAINERS.ratelimit, keyOf(customerId));
  return statusOfFailures(recent(stored?.value, now.getTime()), now.getTime());
}

/**
 * Records one failed lookup. Concurrent recordings never lose a count: the write carries the stored version
 * (`0` for the first one), and a 409 re-reads and retries.
 */
export async function recordFailedLookup(customerId: string, now: Date = new Date()): Promise<RateLimitStatus> {
  const key = keyOf(customerId);
  const t = now.getTime();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const stored = await getObject<Entry>(CONTAINERS.ratelimit, key);
    const failures = [...recent(stored?.value, t), t];
    try {
      await putObject<Entry>(CONTAINERS.ratelimit, key, { failures }, stored ? stored.version : 0);
      return statusOfFailures(failures, t);
    } catch (e) {
      if (statusOf(e) !== 409) throw e;
    }
  }
  throw new Error('rate limit counter is contended; try again');
}

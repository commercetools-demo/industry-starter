import { createHash } from 'node:crypto';

export interface RateLimitOptions { limit: number; windowMs: number }
export interface RateLimitResult { allowed: boolean; retryAfterSeconds: number }

const hits = new Map<string, number[]>();

/** SHA-256 hex of the parts, so no email or address is held in memory in clear. */
export function hashKey(...parts: string[]): string {
  return createHash('sha256').update(parts.join('\u0000').toLowerCase()).digest('hex');
}

/**
 * In-memory sliding window, per server instance (a shared store is needed on multi-instance hosting, Q-J-12).
 * Counts the call when allowed; a refused call is not counted.
 */
export function rateLimit(key: string, { limit, windowMs }: RateLimitOptions, now = Date.now()): RateLimitResult {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    const retryAfterSeconds = Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, list] of hits) if (list.every((t) => now - t >= windowMs)) hits.delete(k);
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function resetRateLimits(): void {
  hits.clear();
}

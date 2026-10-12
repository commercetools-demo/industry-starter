// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// In-memory token bucket (per server instance; enough for the demo mock lookup, a real provider would need a shared store).
export interface RateLimiter {
  /** True when the key may proceed (a token was taken), false when it is over the limit. */
  take(key: string): boolean;
}

export function createRateLimiter(options: { limit: number; windowMs: number; now?: () => number; maxKeys?: number }): RateLimiter {
  const now = options.now ?? Date.now;
  const maxKeys = options.maxKeys ?? 10_000;
  const buckets = new Map<string, { tokens: number; updated: number }>();
  const refillPerMs = options.limit / options.windowMs;
  return {
    take(key) {
      const t = now();
      const bucket = buckets.get(key) ?? { tokens: options.limit, updated: t };
      bucket.tokens = Math.min(options.limit, bucket.tokens + (t - bucket.updated) * refillPerMs);
      bucket.updated = t;
      if (!buckets.has(key) && buckets.size >= maxKeys) buckets.delete(buckets.keys().next().value as string);
      buckets.set(key, bucket);
      if (bucket.tokens < 1) return false;
      bucket.tokens -= 1;
      return true;
    },
  };
}

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import 'server-only';

export interface RateLimiter {
  /** `true` when the call is allowed (and counted), `false` when the key is over its limit for the window. */
  allow(key: string): boolean;
}

/**
 * In-memory sliding window per key (per server instance). Enough to protect an upstream with its own usage policy;
 * not a security boundary. Old keys are dropped when the map grows.
 */
export function createRateLimiter(options: { limit: number; windowMs: number; now?: () => number; maxKeys?: number }): RateLimiter {
  const now = options.now ?? Date.now;
  const maxKeys = options.maxKeys ?? 5000;
  const hits = new Map<string, number[]>();
  return {
    allow(key) {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((at) => t - at < options.windowMs);
      if (recent.length >= options.limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(t);
      hits.set(key, recent);
      if (hits.size > maxKeys) {
        for (const [k, list] of hits) if (!list.some((at) => t - at < options.windowMs)) hits.delete(k);
      }
      return true;
    },
  };
}

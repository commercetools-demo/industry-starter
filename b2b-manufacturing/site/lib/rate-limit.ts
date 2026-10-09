import { createHash } from 'node:crypto';

/** Durable, serverless-safe rate limiting (U-01). A store keeps the recent hit times per key; the limiter decides. */
export interface RateLimitStore {
  /** The stored hit times for a key, with the version needed for an optimistic write; null when the key is new. */
  read(key: string): Promise<{ hits: number[]; version: number } | null>;
  /** Writes the hits. Throws `VersionConflict` when `version` is stale (or the key now exists but `version` is undefined). */
  write(key: string, hits: number[], version?: number): Promise<void>;
}

export class VersionConflict extends Error {}

export interface RateLimitResult { allowed: boolean; retryAfterSec: number }
export interface RateLimiter {
  hit(key: string, options: { limit: number; windowSec: number }): Promise<RateLimitResult>;
}

/** Keys never contain the visitor's address: `<route>.<sha256(ip)>`. */
export const limitKey = (route: string, ...parts: string[]): string => `${route}.${createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 40)}`;

export function createLimiter(store: RateLimitStore, { now = Date.now, retries = 4, log = console.warn }: { now?: () => number; retries?: number; log?: (message: string) => void } = {}): RateLimiter {
  return {
    async hit(key, { limit, windowSec }) {
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        const t = now();
        const stored = await store.read(key).catch((e) => { throw e; });
        const recent = (stored?.hits ?? []).filter((h) => t - h < windowSec * 1000);
        recent.push(t);
        try {
          await store.write(key, recent.slice(-(limit + 1)), stored?.version);
        } catch (error) {
          if (error instanceof VersionConflict) continue;
          // The store is unreachable: let the visitor through rather than lock everyone out, and say so in the log.
          log(`rate limiter store failed (${error instanceof Error ? error.name : 'error'}); allowing the request`);
          return { allowed: true, retryAfterSec: 0 };
        }
        if (recent.length <= limit) return { allowed: true, retryAfterSec: 0 };
        const oldestInWindow = recent[Math.max(0, recent.length - 1 - limit)]!;
        return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((oldestInWindow + windowSec * 1000 - t) / 1000)) };
      }
      log('rate limiter lost the write race repeatedly; allowing the request');
      return { allowed: true, retryAfterSec: 0 };
    },
  };
}

/** In-memory store for tests and local use (one process). */
export function createMemoryStore(): RateLimitStore & { data: Map<string, { hits: number[]; version: number }> } {
  const data = new Map<string, { hits: number[]; version: number }>();
  return {
    data,
    async read(key) { const v = data.get(key); return v ? { hits: [...v.hits], version: v.version } : null; },
    async write(key, hits, version) {
      const current = data.get(key);
      if ((current?.version) !== version) throw new VersionConflict();
      data.set(key, { hits, version: (current?.version ?? 0) + 1 });
    },
  };
}

/** Test double: allows everything. */
export const alwaysAllow: RateLimiter = { hit: async () => ({ allowed: true, retryAfterSec: 0 }) };

/** The limits of the plan (U): register 5/hour/IP, login 10/10 min/IP+email, quote request 10/hour/user. */
export const LIMITS = {
  register: { limit: 5, windowSec: 3600 },
  login: { limit: 10, windowSec: 600 },
  quoteRequest: { limit: 10, windowSec: 3600 },
} as const;

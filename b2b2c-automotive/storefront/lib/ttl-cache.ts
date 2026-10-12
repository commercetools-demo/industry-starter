// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// In-memory TTL cache for data shared by all users (store definitions). Never for per-user data.
export interface TtlCache<T> {
  /** The fresh entry: `{ value }` (value may be null for a negative entry), or `undefined` when absent or expired. */
  get(key: string): { value: T | null } | undefined;
  /** Stores a value; `null` is a negative entry ("not found") with the shorter TTL. */
  set(key: string, value: T | null): void;
  /** The entry even when expired (served when the source is down). */
  getStale(key: string): { value: T | null } | undefined;
}

export function createTtlCache<T>(options: { ttlMs: number; negativeTtlMs: number; now?: () => number }): TtlCache<T> {
  const now = options.now ?? Date.now;
  const entries = new Map<string, { value: T | null; expires: number }>();
  return {
    get(key) {
      const entry = entries.get(key);
      return entry && entry.expires > now() ? { value: entry.value } : undefined;
    },
    set(key, value) {
      entries.set(key, { value, expires: now() + (value === null ? options.negativeTtlMs : options.ttlMs) });
    },
    getStale(key) {
      const entry = entries.get(key);
      return entry ? { value: entry.value } : undefined;
    },
  };
}

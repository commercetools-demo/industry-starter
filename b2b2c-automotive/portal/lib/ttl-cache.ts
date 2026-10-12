// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Small in-memory TTL cache. Never hold per-user data in it (store and unit configuration only).
export interface TtlCache<T> {
  /** The fresh value, `null` for a fresh "not found" entry, `undefined` when absent or expired. */
  get(key: string): T | null | undefined;
  /** `null` records "not found" with the shorter negative TTL. */
  set(key: string, value: T | null): void;
  /** The last known value even when expired (for serving through an outage); `undefined` when none or a "not found" entry. */
  getStale(key: string): T | undefined;
  clear(): void;
}

export function createTtlCache<T>(options: { ttlMs: number; negativeTtlMs: number; now?: () => number }): TtlCache<T> {
  const { ttlMs, negativeTtlMs, now = () => Date.now() } = options;
  const entries = new Map<string, { value: T | null; expires: number }>();
  return {
    get(key) {
      const entry = entries.get(key);
      return entry && entry.expires > now() ? entry.value : undefined;
    },
    set(key, value) {
      entries.set(key, { value, expires: now() + (value === null ? negativeTtlMs : ttlMs) });
    },
    getStale(key) {
      return entries.get(key)?.value ?? undefined;
    },
    clear() {
      entries.clear();
    },
  };
}

// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from commerce-common/commerce_common/types.py; changes: TypeScript port; Map keeps insertion order; memory facts not ported (memory is off in this deployment); clock formatting lives in runtime/session-clock.ts.

/** Records a provenance map keeps: the newest; a dropped id needs a fresh read. Upstream's 200 is too large to rewrite every turn on a serverless host; the deployment passes its own cap (see `deployment.ts`). */
export const UPSTREAM_PROVENANCE_CAP = 200;

/**
 * Insert `value` as the newest record. Re-inserting an existing key moves it to the newest position (delete then set), and the
 * oldest records go first once the cap is exceeded: eviction order is arrival order.
 * A `Map` is used on purpose: a plain object hoists integer-like keys (numeric SKUs) ahead of every other key and would
 * silently change which record is evicted.
 */
export function remember<T>(records: Map<string, T>, key: string, value: T, cap: number): void {
  records.delete(key);
  records.set(key, value);
  while (records.size > cap) {
    const oldest = records.keys().next();
    if (oldest.done) break;
    records.delete(oldest.value);
  }
}

/** The host-supplied clock a session context carries: an IANA `timezone`, or an explicit `now` that overrides it. With neither set the prompt carries no local time, because the server's clock is not the shopper's. */
export interface ClockContext {
  timezone?: string;
  now?: Date;
}

/** True when `zone` is an IANA zone this runtime knows. An unknown zone means "no clock line", never a guess. */
export function isKnownTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

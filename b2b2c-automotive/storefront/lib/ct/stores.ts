// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import 'server-only';
import { apiRoot } from '@/lib/ct/client';
import { KEY_PATTERN } from '@/lib/ct/in-store';
import { mapStore } from '@/lib/mappers';
import { createTtlCache } from '@/lib/ttl-cache';
import type { StoreSummary } from '@/lib/types';

// Store definitions are the same for every shopper, so one in-memory cache per server instance is safe.
const cache = createTtlCache<StoreSummary>({ ttlMs: 60_000, negativeTtlMs: 10_000 });

const statusOf = (error: unknown): number | undefined =>
  typeof error === 'object' && error !== null ? (error as { statusCode?: number }).statusCode : undefined;

/**
 * Reads a store with its distribution and supply channels and maps it to the session fields.
 * `null` when the key is not a valid key, the store does not exist, or it cannot serve a catalogue (no channel or selection).
 * A commercetools outage serves the last known store; without one the error is rethrown (the proxy answers 503).
 */
export async function getStoreContext(storeKey: string): Promise<StoreSummary | null> {
  if (!KEY_PATTERN.test(storeKey)) return null;
  const hit = cache.get(storeKey);
  if (hit) return hit.value;
  try {
    const { body } = await apiRoot
      .stores()
      .withKey({ key: storeKey })
      .get({ queryArgs: { expand: ['distributionChannels[*]', 'supplyChannels[*]'] } })
      .execute();
    const summary = mapStore(body);
    cache.set(storeKey, summary);
    return summary;
  } catch (error) {
    if (statusOf(error) === 404) {
      cache.set(storeKey, null);
      return null;
    }
    const stale = cache.getStale(storeKey);
    if (stale?.value) return stale.value;
    throw error;
  }
}

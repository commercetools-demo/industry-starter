// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import 'server-only';
import { apiRoot } from '@/lib/ct/client';
import { mapStore } from '@/lib/mappers/store';
import { createTtlCache } from '@/lib/ttl-cache';
import type { StoreContext, StoreSummary } from '@/lib/types';

/** commercetools key pattern; a store key from outside is checked against it before it reaches the API. */
export const KEY_PATTERN = /^[A-Za-z0-9_-]{2,256}$/;

const cache = createTtlCache<StoreSummary>({ ttlMs: 60_000, negativeTtlMs: 10_000 });
export const clearStoreCache = (): void => cache.clear();

/**
 * One store with its default channel pair and product selection, cached 60 s (10 s for "not found").
 * `null` when the store does not exist or cannot serve (no channel or selection). On a commercetools error the last
 * known value is served; with none the error is rethrown (never reported as "not found").
 */
export async function getStoreContext(storeKey: string): Promise<StoreSummary | null> {
  if (!KEY_PATTERN.test(storeKey)) return null;
  const hit = cache.get(storeKey);
  if (hit !== undefined) return hit;
  try {
    const { body } = await apiRoot
      .stores()
      .withKey({ key: storeKey })
      .get({ queryArgs: { expand: ['distributionChannels[*]', 'supplyChannels[*]', 'productSelections[*].productSelection'] } })
      .execute();
    const summary = mapStore(body);
    cache.set(storeKey, summary);
    return summary;
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 404) {
      cache.set(storeKey, null);
      return null;
    }
    const stale = cache.getStale(storeKey);
    if (stale) return stale;
    throw error;
  }
}

/** The four store fields for the session; throws `Store not available` when the store is unknown or incomplete. */
export async function getStoreChannelData(storeKey: string): Promise<StoreContext> {
  const store = await getStoreContext(storeKey);
  if (!store) throw new Error('Store not available');
  const { distributionChannelId, supplyChannelId, productSelectionId } = store;
  return { storeKey: store.storeKey, distributionChannelId, supplyChannelId, productSelectionId };
}

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The reseller list of the Malva finder (change add-malva-home, D5): every store with a distribution channel, its address and its branches.
import 'server-only';
import type { Store } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { mapReseller } from '@/lib/mappers/malva';
import type { Reseller } from '@/lib/malva-types';
import { createTtlCache } from '@/lib/ttl-cache';

// The store list is the same for every visitor: one in-memory cache per server instance, 60 s. Mapping to a locale happens per call.
const cache = createTtlCache<Store[]>({ ttlMs: 60_000, negativeTtlMs: 10_000 });
const ALL = 'all';

async function readStores(): Promise<Store[]> {
  const hit = cache.get(ALL);
  if (hit?.value) return hit.value;
  try {
    const { body } = await apiRoot
      .stores()
      .get({ queryArgs: { expand: ['distributionChannels[*]'], sort: 'key asc', limit: 500 } })
      .execute();
    cache.set(ALL, body.results);
    return body.results;
  } catch (error) {
    const stale = cache.getStale(ALL);
    if (stale?.value) return stale.value;
    throw error;
  }
}

/**
 * Resellers for the finder, sorted by store key; a store without a distribution channel is left out. The result carries no channel,
 * selection or store id. A commercetools outage serves the last known list; without one the error is rethrown.
 */
export async function listResellers(locale: string): Promise<Reseller[]> {
  const stores = await readStores();
  return stores.map((s) => mapReseller(s, locale)).filter((r): r is Reseller => r !== null);
}

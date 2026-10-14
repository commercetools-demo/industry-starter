// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import 'server-only';
import type { Store } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { KEY_PATTERN } from '@/lib/ct/in-store';
import { mapShellContext } from '@/lib/mappers';
import { createTtlCache } from '@/lib/ttl-cache';
import type { ShellContext } from '@/lib/types';

// The store body (settings and branch channels) is the same for every shopper: one in-memory cache per server instance, 60 s.
// Mapping to a locale happens per call, so the cache holds one entry per store, not per locale.
const cache = createTtlCache<Store>({ ttlMs: 60_000, negativeTtlMs: 10_000 });

const statusOf = (error: unknown): number | undefined =>
  typeof error === 'object' && error !== null ? (error as { statusCode?: number }).statusCode : undefined;

/**
 * Store settings, branches (channels with `branch-info`) and the retail channel for the shell and the picker.
 * `null` for an invalid or unknown store key. A commercetools outage serves the last known store; without one the error is rethrown.
 */
export async function getShellContext(storeKey: string, locale: string): Promise<ShellContext | null> {
  if (!KEY_PATTERN.test(storeKey)) return null;
  const hit = cache.get(storeKey);
  if (hit) return hit.value ? mapShellContext(hit.value, locale) : null;
  try {
    const { body } = await apiRoot
      .stores()
      .withKey({ key: storeKey })
      .get({ queryArgs: { expand: ['distributionChannels[*]'] } })
      .execute();
    cache.set(storeKey, body);
    return mapShellContext(body, locale);
  } catch (error) {
    if (statusOf(error) === 404) {
      cache.set(storeKey, null);
      return null;
    }
    const stale = cache.getStale(storeKey);
    if (stale?.value) return mapShellContext(stale.value, locale);
    throw error;
  }
}

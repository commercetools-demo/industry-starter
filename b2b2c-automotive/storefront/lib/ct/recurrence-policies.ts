// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The recurrence policies offered by "Subscribe and save" (workstream M): `mau-rp-*`, names in the shopper's language. The same
// for every shopper: one in-memory cache per server instance and locale, one hour.
import 'server-only';
import type { RecurrencePolicy } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { POLICY_KEY_PREFIX } from '@/lib/subscriptions/config';
import { createTtlCache } from '@/lib/ttl-cache';
import type { PolicyOption } from '@/lib/types';
import { getLocalizedString } from '@/lib/utils';

const cache = createTtlCache<PolicyOption[]>({ ttlMs: 3_600_000, negativeTtlMs: 30_000 });

/** Shortest interval first (monthly, every 3 months, every 6 months). */
const months = (p: RecurrencePolicy): number => {
  const { schedule } = p;
  if (schedule.type !== 'standard') return Number.MAX_SAFE_INTEGER;
  return schedule.intervalUnit === 'Months' ? schedule.value : schedule.intervalUnit === 'Weeks' ? schedule.value / 4 : schedule.intervalUnit === 'Days' ? schedule.value / 30 : schedule.value * 12;
};

export async function listRecurrencePolicies(locale: string): Promise<PolicyOption[]> {
  const hit = cache.get(locale);
  if (hit?.value) return hit.value;
  try {
    const { body } = await apiRoot.recurrencePolicies().get({ queryArgs: { limit: 50, sort: 'createdAt asc' } }).execute();
    const list = body.results
      .filter((p) => p.key.startsWith(POLICY_KEY_PREFIX))
      .sort((a, b) => months(a) - months(b))
      .map((p) => ({ key: p.key, label: getLocalizedString(p.name, locale) || p.key }));
    cache.set(locale, list);
    return list;
  } catch (error) {
    const stale = cache.getStale(locale)?.value;
    if (stale) return stale;
    throw error;
  }
}

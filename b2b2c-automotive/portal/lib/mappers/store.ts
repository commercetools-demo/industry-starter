// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Store } from '@commercetools/platform-sdk';
import { DEFAULT_LOCALE_KEY } from '@/i18n/config';
import type { ChannelRef, StoreSummary } from '@/lib/types';
import { COUNTRY_CONFIG, getLocalizedString } from '@/lib/utils';

const byKey = (a: { key: string }, b: { key: string }) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

function channels(refs: Store['distributionChannels'] | Store['supplyChannels']): ChannelRef[] {
  return (refs ?? [])
    .map((r) => ({ id: r.id, key: r.obj?.key ?? '' }))
    .filter((c) => c.key !== '')
    .sort(byKey);
}

/**
 * A store as the app sees it, or `null` when it cannot serve the portal: no distribution channel, no supply channel
 * or no active product selection. Defaults (Q-G03): first channel of each kind by ascending key; the first active
 * product selection by ascending key. The store must be read with the channels and selections expanded.
 */
export function mapStore(store: Store): StoreSummary | null {
  const distributionChannels = channels(store.distributionChannels);
  const supplyChannels = channels(store.supplyChannels);
  const selections = (store.productSelections ?? [])
    .filter((s) => s.active !== false)
    .map((s) => ({ id: s.productSelection.id, key: s.productSelection.obj?.key ?? s.productSelection.id }))
    .sort(byKey);
  if (!distributionChannels[0] || !supplyChannels[0] || !selections[0]) return null;
  const countries = (store.countries ?? []).map((c) => c.code);
  const currencies = [
    ...new Set(
      Object.values(COUNTRY_CONFIG)
        .filter((c) => countries.includes(c.country))
        .map((c) => c.currency),
    ),
  ];
  return {
    key: store.key,
    storeKey: store.key,
    name: getLocalizedString(store.name, DEFAULT_LOCALE_KEY),
    nameLocalized: { ...(store.name ?? {}) },
    countries,
    currencies,
    distributionChannelId: distributionChannels[0].id,
    supplyChannelId: supplyChannels[0].id,
    productSelectionId: selections[0].id,
    distributionChannels,
    supplyChannels,
  };
}

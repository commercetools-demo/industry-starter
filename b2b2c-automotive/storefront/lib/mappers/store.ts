// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { ChannelReference, ProductSelectionSetting, Store } from '@commercetools/platform-sdk';
import type { ChannelRef, StoreSummary } from '@/lib/types';
import { getLocalizedString } from '@/lib/utils';

function channelRefs(channels: ChannelReference[] | undefined): ChannelRef[] {
  return (channels ?? [])
    .map((c) => ({ id: c.id, key: c.obj?.key ?? '' }))
    .filter((c) => c.id && c.key)
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** The store's active product selection (first active one); `undefined` when there is none. */
function activeSelectionId(settings: ProductSelectionSetting[] | undefined): string | undefined {
  return settings?.find((s) => s.active !== false)?.productSelection.id;
}

/**
 * Maps a store (read with channels expanded) to what the session needs. `null` when the store cannot serve a catalogue:
 * no distribution channel, no supply channel or no product selection. The default pair is the first channel of each by key (Q-G03).
 */
export function mapStore(store: Store): StoreSummary | null {
  const distributionChannels = channelRefs(store.distributionChannels);
  const supplyChannels = channelRefs(store.supplyChannels);
  const productSelectionId = activeSelectionId(store.productSelections);
  if (!distributionChannels.length || !supplyChannels.length || !productSelectionId) return null;
  const nameLocalized = store.name ?? {};
  return {
    key: store.key,
    name: getLocalizedString(nameLocalized, 'de-DE') || store.key,
    nameLocalized,
    countries: (store.countries ?? []).map((c) => c.code),
    distributionChannels,
    supplyChannels,
    storeKey: store.key,
    distributionChannelId: distributionChannels[0].id,
    supplyChannelId: supplyChannels[0].id,
    productSelectionId,
  };
}

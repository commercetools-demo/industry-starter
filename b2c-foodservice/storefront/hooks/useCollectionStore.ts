'use client';

import { useLocale } from 'next-intl';
import { useCallback } from 'react';
import { useChannels, type ChannelsResponse } from '@/hooks/useChannels';
import { fetchJson } from '@/hooks/fetcher';
import { useStoreContext } from '@/context/store-context';
import type { Store } from '@/lib/types';
import { marketForLocale } from '@/lib/utils';

/**
 * The shopper's chosen collection store and the store picker, for G, H and I.
 *
 *  - `store`: the chosen Store or null (also null in Canada, which has no stores).
 *  - `stores`: the market's stores (empty in Canada, so hide collection UI when `stores.length === 0` and not loading).
 *  - `select(key | null)`: persists the choice in the session (PUT /api/session/store); optimistic, rolls back and
 *    resolves false on failure.
 *  - `open({ sku })` opens the picker modal (with an availability line per store when a sku is given); `close()`.
 *  - `preferShip`: true after "Ship to me instead" from a product; H uses it to preselect Ship.
 */
export function useCollectionStore() {
  const country = marketForLocale(useLocale()).country;
  const { data, error, isLoading, mutate } = useChannels(country);
  const ctx = useStoreContext();

  const stores: Store[] = data?.stores ?? [];
  const selectedKey = data?.selectedKey ?? null;
  const store = stores.find((s) => s.key === selectedKey) ?? null;

  const select = useCallback(
    async (storeKey: string | null): Promise<boolean> => {
      const previous = data;
      const optimistic: ChannelsResponse = { stores: previous?.stores ?? [], selectedKey: storeKey };
      await mutate(optimistic, { revalidate: false });
      try {
        await fetchJson('/api/session/store', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storeKey, country }),
        });
        return true;
      } catch {
        await mutate(previous, { revalidate: false });
        return false;
      }
    },
    [data, mutate, country],
  );

  return {
    store,
    stores,
    isLoading,
    error: Boolean(error),
    retry: () => mutate(),
    select,
    open: ctx.openPicker,
    close: ctx.closePicker,
    isOpen: ctx.open,
    sku: ctx.sku,
    preferShip: ctx.preferShip,
    setPreferShip: ctx.setPreferShip,
  };
}

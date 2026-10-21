'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { fetchJson } from '@/hooks/fetcher';
import { useAccount } from '@/hooks/useAccount';
import { useAccountSwr } from '@/hooks/useAccountSwr';
import { KEY_CART, KEY_CART_COUNT, keySavedItemsView } from '@/lib/cache-keys';
import type { SavedAddAllResult, SavedList } from '@/lib/types';

const post = <T,>(url: string, body?: unknown): Promise<T> =>
  fetchJson<T>(url, {
    method: 'POST',
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });

/** The Saved tab's data: the list with a card per product (price in the shopper's market), Add all to bag, and Save from bag. */
export function useSavedList() {
  const { customer } = useAccount();
  const customerId = customer?.id ?? null;
  const { mutate } = useSWRConfig();
  const { data, error, isLoading, mutate: reload } = useAccountSwr<{ list: SavedList | null }>(
    customerId ? keySavedItemsView(customerId, 'full') : null,
    '/api/shopping-lists',
  );

  /** One call per saved product on the server; the list stays as it is. The bag and its badge are refreshed. */
  const addAll = useCallback(async (): Promise<SavedAddAllResult> => {
    const res = await post<SavedAddAllResult>('/api/shopping-lists/add-to-cart');
    await Promise.all([mutate(KEY_CART_COUNT), mutate(KEY_CART)]);
    return res;
  }, [mutate]);

  /** For an empty list: saves the products of the bag. */
  const fromBag = useCallback(async () => {
    await post('/api/shopping-lists', { fromCart: true });
    if (customerId) await Promise.all([mutate(keySavedItemsView(customerId, 'ids')), reload()]);
  }, [customerId, mutate, reload]);

  return { list: data?.list ?? null, isLoading: customer === undefined || isLoading, isError: Boolean(error), reload, addAll, fromBag };
}

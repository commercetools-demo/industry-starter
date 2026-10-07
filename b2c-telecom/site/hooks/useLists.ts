'use client';

import { useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { KEY_CART, KEY_LISTS, keyList } from '@/lib/cache-keys';
import type { BundleMoveResult, SavedList, SavedListDetail } from '@/lib/types';
import { accountRequest } from './accountRequest';

export { KEY_LISTS, keyList };

const URL = '/api/account/lists';
type ListsPayload = { lists: SavedList[] };
type ListPayload = { list: SavedListDetail };

/** The customer's lists. `enabled: false` (anonymous) makes no request. */
export function useLists({ enabled = true }: { enabled?: boolean } = {}) {
  const { data, error, isLoading } = useSWR<ListsPayload>(enabled ? KEY_LISTS : null, () => accountRequest<ListsPayload>(URL, 'GET'));
  return { lists: data?.lists ?? [], isLoading, error };
}

/** One list with its lines priced now. */
export function useList(id: string) {
  const { data, error, isLoading } = useSWR<ListPayload>(keyList(id), () => accountRequest<ListPayload>(`${URL}/${encodeURIComponent(id)}`, 'GET'));
  return { list: data?.list, isLoading, error };
}

export interface ListMutations {
  create: (name: string, fromCart?: boolean) => Promise<SavedListDetail>;
  rename: (id: string, name: string) => Promise<SavedListDetail>;
  remove: (id: string) => Promise<void>;
  addOffer: (listId: string, offerKey: string, variantId?: number) => Promise<SavedListDetail>;
  removeLine: (listId: string, lineId: string) => Promise<SavedListDetail>;
  /** Moves the list into My bundle; the answer's bundle goes into the cart cache. The list is not changed. */
  moveToBundle: (listId: string) => Promise<BundleMoveResult>;
}

/** Writes answer with the list (or the lists); the answer goes into the cache, the index of lists is revalidated. */
export function useListMutations(): ListMutations {
  const { mutate } = useSWRConfig();
  return useMemo<ListMutations>(() => {
    const store = async (payload: ListPayload): Promise<SavedListDetail> => {
      await mutate(keyList(payload.list.id), payload, { revalidate: false });
      await mutate(KEY_LISTS);
      return payload.list;
    };
    return {
      create: async (name, fromCart = false) => store(await accountRequest<ListPayload>(URL, 'POST', { name, ...(fromCart ? { fromCart: true } : {}) })),
      rename: async (id, name) => store(await accountRequest<ListPayload>(`${URL}/${encodeURIComponent(id)}`, 'PATCH', { name })),
      remove: async (id) => {
        const payload = await accountRequest<ListsPayload>(`${URL}/${encodeURIComponent(id)}`, 'DELETE');
        await mutate(KEY_LISTS, payload, { revalidate: false });
        await mutate(keyList(id), undefined, { revalidate: false });
      },
      addOffer: async (listId, offerKey, variantId) => store(await accountRequest<ListPayload>(`${URL}/${encodeURIComponent(listId)}/lines`, 'POST', { offerKey, ...(variantId === undefined ? {} : { variantId }) })),
      removeLine: async (listId, lineId) => store(await accountRequest<ListPayload>(`${URL}/${encodeURIComponent(listId)}/lines/${encodeURIComponent(lineId)}`, 'DELETE')),
      moveToBundle: async (listId) => {
        const result = await accountRequest<BundleMoveResult>(`${URL}/${encodeURIComponent(listId)}/add-to-bundle`, 'POST', {});
        await mutate(KEY_CART, result.cart, { revalidate: false });
        return result;
      },
    };
  }, [mutate]);
}

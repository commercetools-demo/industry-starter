'use client';
import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { API_LISTS, API_LISTS_SAVE, apiList, apiListAddAll, apiListLine } from '@/lib/api-paths';
import { KEY_CART, KEY_CART_DETAILS } from '@/lib/cache-keys';
import { fetchJson } from '@/lib/http';
import type { AddAllResult, ListSummary } from '@/lib/lists-types';

const json = { 'content-type': 'application/json' } as const;
const body = (value: unknown): RequestInit => ({ headers: json, body: JSON.stringify(value) });

export interface SaveRxResult {
  listId: string;
  saved: number;
  alreadySaved: number;
}

/**
 * The saved-list writes. The list pages are server-rendered per patient (no client cache of lists), so after a write
 * the caller refreshes the route. The RX number only ever travels in a body.
 */
export function useListActions() {
  const { mutate } = useSWRConfig();

  const create = useCallback((name: string, fromCart = false) => fetchJson<ListSummary>(API_LISTS, { method: 'POST', ...body({ name, fromCart }) }), []);
  const rename = useCallback((id: string, name: string) => fetchJson<ListSummary>(apiList(id), { method: 'PATCH', ...body({ name }) }), []);
  const remove = useCallback((id: string) => fetchJson<{ deleted: true }>(apiList(id), { method: 'DELETE' }), []);
  const removeLine = useCallback((id: string, lineId: string) => fetchJson<ListSummary>(apiListLine(id, lineId), { method: 'DELETE' }), []);

  /** Re-validates every line now and adds the dispensable ones to the cart; the cart caches are refreshed. */
  const addAll = useCallback(
    async (id: string): Promise<AddAllResult> => {
      const result = await fetchJson<AddAllResult>(apiListAddAll(id), { method: 'POST', headers: json });
      await Promise.all([mutate(KEY_CART), mutate(KEY_CART_DETAILS)]);
      return result;
    },
    [mutate],
  );

  /** "Save to My medicines" on a prescription card. */
  const saveRx = useCallback((rxNumber: string, lineRefs: string[]) => fetchJson<SaveRxResult>(API_LISTS_SAVE, { method: 'POST', ...body({ rxNumber, lineRefs }) }), []);

  return { create, rename, remove, removeLine, addAll, saveRx };
}

export type SaveRx = ReturnType<typeof useListActions>['saveRx'];

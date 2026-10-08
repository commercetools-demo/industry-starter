'use client';
import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { apiOrderCancel, apiOrderReorder } from '@/lib/api-paths';
import { KEY_CART, KEY_CART_DETAILS } from '@/lib/cache-keys';
import { fetchJson } from '@/lib/http';
import type { OrderView, ReorderResult } from '@/lib/order-types';

const json = { 'content-type': 'application/json' } as const;

/**
 * The order pages are server-rendered per patient (no client cache of orders to clear at sign-out); these are the two
 * writes. After either, the caller refreshes the route.
 */
export function useOrderActions() {
  const { mutate } = useSWRConfig();

  /** Cancels an order that has not been packed. Throws `HttpError` (409 when it is too late). */
  const cancel = useCallback((id: string): Promise<OrderView> => fetchJson<OrderView>(apiOrderCancel(id), { method: 'POST', headers: json }), []);

  /** Re-validates every line of a past order and adds the dispensable ones to the cart. */
  const reorder = useCallback(
    async (id: string): Promise<ReorderResult> => {
      const result = await fetchJson<ReorderResult>(apiOrderReorder(id), { method: 'POST', headers: json });
      await Promise.all([mutate(KEY_CART), mutate(KEY_CART_DETAILS)]);
      return result;
    },
    [mutate],
  );

  return { cancel, reorder };
}

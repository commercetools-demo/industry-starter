'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { KEY_CART } from '@/lib/cache-keys';
import { sendJson } from '@/lib/fetcher';
import type { ReorderResult } from '@/lib/types';

/**
 * "Buy again": asks the server to copy an order into a new bundle. The answer carries the new, full bundle, which is written into the
 * `KEY_CART` cache (never refetched, never computed here) so the header pill is right before the navigation. Throws `ApiError`.
 */
export function useReorder(): { reorder: (orderNumber: string) => Promise<ReorderResult> } {
  const { mutate } = useSWRConfig();
  const reorder = useCallback(
    async (orderNumber: string) => {
      const result = await sendJson<ReorderResult>(`/api/orders/${encodeURIComponent(orderNumber)}/reorder`, 'POST');
      await mutate(KEY_CART, result.cart, { revalidate: false });
      return result;
    },
    [mutate],
  );
  return { reorder };
}

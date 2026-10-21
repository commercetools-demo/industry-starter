'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { fetchJson } from '@/hooks/fetcher';
import { useAccount } from '@/hooks/useAccount';
import { keyOrder } from '@/lib/cache-keys';
import type { OrderView, ReorderResult } from '@/lib/types';

export interface ReturnLineDraft { lineId: string; quantity: number; reason?: string }

const post = <T,>(url: string, body?: unknown): Promise<T> =>
  fetchJson<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

/** Writes on one order: start a return and Buy again. Failures throw `ApiError` (code, status, `extra.fields`). */
export function useOrderActions() {
  const { mutate } = useSWRConfig();
  const { customer } = useAccount();
  const customerId = customer?.id ?? null;

  const startReturn = useCallback(
    async (order: Pick<OrderView, 'id' | 'orderNumber'>, items: ReturnLineDraft[]): Promise<OrderView> => {
      const res = await post<{ order: OrderView }>(`/api/orders/${encodeURIComponent(order.id)}/returns`, { items });
      // Only this order's own key: the cached detail becomes the answer, no refetch.
      if (customerId) await mutate(keyOrder(customerId, order.id), res, { revalidate: false });
      return res.order;
    },
    [mutate, customerId],
  );

  const reorder = useCallback(async (orderId: string): Promise<ReorderResult> => {
    const res = await post<ReorderResult>(`/api/orders/${encodeURIComponent(orderId)}/reorder`);
    return res;
  }, []);

  return { startReturn, reorder };
}

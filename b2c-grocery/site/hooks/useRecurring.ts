'use client';

import { useCallback, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { KEY_RECURRING } from '@/lib/cache-keys';
import { ApiError, fetchJson, sendJson } from '@/lib/fetcher';
import type { RecurringOrderSummary, RecurringOrdersResponse } from '@/lib/types';

/** A missing session (401), a disabled feature (404) or a bad request will not change by retrying. */
const retryable = (error: unknown): boolean => !(error instanceof ApiError && error.status >= 400 && error.status < 500);

/** The customer's recurring orders and the cadences they can switch to (client-fetched, never cached by the server). Safe defaults: none. */
export function useRecurring() {
  const swr = useSWR<RecurringOrdersResponse>(KEY_RECURRING, () => fetchJson<RecurringOrdersResponse>('/api/account/recurring'), {
    revalidateOnFocus: true,
    shouldRetryOnError: retryable,
  });
  return { ...swr, recurringOrders: swr.data?.recurringOrders ?? [], policies: swr.data?.policies ?? [] };
}

type Change =
  | { action: 'set-cadence'; policyKey: string }
  | { action: 'set-quantity'; lineId: string; quantity: number }
  | { action: 'pause' }
  | { action: 'resume' }
  | { action: 'cancel' };

/**
 * Change one recurring order. The answer is the refreshed summary of the **same** order: it replaces that entry in the
 * cached list. A failure throws `ApiError` (404 not found, 409 wrong state or conflict) and refreshes the list so the page
 * shows what the server has.
 */
export function useRecurringMutations() {
  const { mutate } = useSWRConfig();

  const apply = useCallback(
    async (id: string, change: Change): Promise<RecurringOrderSummary> => {
      try {
        const { recurringOrder } = await sendJson<{ recurringOrder: RecurringOrderSummary }>(`/api/account/recurring/${encodeURIComponent(id)}`, 'PATCH', change);
        await mutate<RecurringOrdersResponse>(
          KEY_RECURRING,
          (current) => (current ? { ...current, recurringOrders: current.recurringOrders.map((r) => (r.id === id ? recurringOrder : r)) } : current),
          { revalidate: false },
        );
        return recurringOrder;
      } catch (e) {
        void mutate(KEY_RECURRING);
        throw e;
      }
    },
    [mutate],
  );

  const setCadence = useCallback((id: string, policyKey: string) => apply(id, { action: 'set-cadence', policyKey }), [apply]);
  const setQuantity = useCallback((id: string, lineId: string, quantity: number) => apply(id, { action: 'set-quantity', lineId, quantity }), [apply]);
  const pause = useCallback((id: string) => apply(id, { action: 'pause' }), [apply]);
  const resume = useCallback((id: string) => apply(id, { action: 'resume' }), [apply]);
  const cancel = useCallback((id: string) => apply(id, { action: 'cancel' }), [apply]);

  return useMemo(() => ({ setCadence, setQuantity, pause, resume, cancel }), [setCadence, setQuantity, pause, resume, cancel]);
}

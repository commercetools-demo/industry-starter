'use client';

import { useCallback, useMemo } from 'react';
import { useSWRConfig } from 'swr';
import { KEY_ORDERS, keyOrder } from '@/lib/cache-keys';
import type { CancelReason, Order, ReturnReason } from '@/lib/types';
import { accountRequest } from './accountRequest';

export interface CancelInput {
  reason: CancelReason;
  note?: string;
}
export interface ReturnInput {
  items: { lineItemId: string; quantity: number }[];
  reason: ReturnReason;
  note?: string;
}

export interface OrderActions {
  /** Cancels the whole order. Throws `AccountApiError` (`NOT_CANCELLABLE` with `details.block`, `CANCEL_FAILED`, `NETWORK`, ...). */
  cancel: (orderNumber: string, input: CancelInput) => Promise<Order>;
  /** Records the return of devices. Throws `AccountApiError` (`QUANTITY_TOO_HIGH`, `WINDOW_CLOSED`, `RETURN_FAILED`, ...). */
  requestReturn: (orderNumber: string, input: ReturnInput) => Promise<Order>;
}

const url = (orderNumber: string, action: 'cancel' | 'return'): string => `/api/orders/${encodeURIComponent(orderNumber)}/${action}`;

/** Post-purchase actions of the order page (V). The answer carries the whole updated order; callers refresh the server-rendered page. */
export function useOrderActions(): OrderActions {
  const { mutate } = useSWRConfig();
  const send = useCallback(
    async (orderNumber: string, action: 'cancel' | 'return', body: unknown): Promise<Order> => {
      const { order } = await accountRequest<{ order: Order }>(url(orderNumber, action), 'POST', body);
      await mutate(keyOrder(orderNumber), order, { revalidate: false });
      await mutate(KEY_ORDERS);
      return order;
    },
    [mutate],
  );
  return useMemo(
    () => ({
      cancel: (orderNumber, input) => send(orderNumber, 'cancel', input),
      requestReturn: (orderNumber, input) => send(orderNumber, 'return', input),
    }),
    [send],
  );
}

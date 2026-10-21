'use client';

import useSWR from 'swr';
import { jsonFetcher } from '@/hooks/fetcher';
import { useAccount } from '@/hooks/useAccount';
import { keyOrder } from '@/lib/cache-keys';
import type { OrderView } from '@/lib/types';

/** Polling period while an order is being collected. */
export const ORDER_POLL_MS = 30_000;

/** Poll only an order that has a collection to track and has not reached `collected`. A delivery-only order has no tracker. */
export function pollInterval(order: Pick<OrderView, 'state' | 'collect'> | undefined): number {
  if (!order || order.collect.length === 0 || order.state === null || order.state === 'collected') return 0;
  return ORDER_POLL_MS;
}

/**
 * The order shown on the confirmation page. The server render is the first value (`initial`); the state is read again every 30 s
 * while a collection is under way and never after `collected`. SWR clears its timer when the component unmounts.
 */
export function useOrderStatus(orderId: string, initial: OrderView) {
  const { customer } = useAccount();
  const { data, error } = useSWR<{ order: OrderView }>(
    keyOrder(customer?.id ?? 'guest', orderId),
    () => jsonFetcher<{ order: OrderView }>(`/api/orders/${encodeURIComponent(orderId)}`),
    {
      fallbackData: { order: initial },
      revalidateOnMount: false,
      revalidateOnFocus: false,
      refreshInterval: (latest) => pollInterval(latest?.order),
      shouldRetryOnError: false,
    },
  );
  return { order: data?.order ?? initial, error: error as unknown };
}

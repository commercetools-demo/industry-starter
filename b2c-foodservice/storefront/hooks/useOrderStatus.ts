'use client';

import useSWR from 'swr';
import { ApiError, jsonFetcher } from '@/hooks/fetcher';
import { useAccount } from '@/hooks/useAccount';
import { keyOrder } from '@/lib/cache-keys';
import type { OrderView } from '@/lib/types';

/** Polling period while an order is being collected. */
export const ORDER_POLL_MS = 30_000;

/**
 * Poll only an order that has a collection to track and has not reached `collected` (or been cancelled). A delivery-only order has
 * no tracker, and an order without a state yet is not polled either.
 */
export function pollInterval(order: (Pick<OrderView, 'state' | 'collect'> & { status?: OrderView['status'] }) | undefined): number {
  if (!order || order.collect.length === 0 || order.state === null || order.state === 'collected' || order.status === 'cancelled') return 0;
  return ORDER_POLL_MS;
}

interface OrderStatus<O> {
  order: O;
  error: unknown;
  isLoading: boolean;
  /** True when the read answered 404 (unknown or someone else's order). */
  notFound: boolean;
  mutate: () => Promise<unknown>;
}

/**
 * The one hook for a single order, used by the confirmation page and the account order detail. The server render is the first
 * value (`initial`); the order is read again every 30 s while a collection is under way and never after `collected`. Without
 * `initial` the order is fetched on mount. SWR clears its timer when the component unmounts. The SWR key is
 * `keyOrder(customer, orderId)`; a write (a return) puts the new view under that key.
 */
export function useOrderStatus(orderId: string, initial: OrderView): OrderStatus<OrderView>;
export function useOrderStatus(orderId: string, initial?: OrderView | null): OrderStatus<OrderView | null>;
export function useOrderStatus(orderId: string, initial?: OrderView | null): OrderStatus<OrderView | null> {
  const { customer } = useAccount();
  const { data, error, isLoading, mutate } = useSWR<{ order: OrderView }>(
    keyOrder(customer?.id ?? 'guest', orderId),
    () => jsonFetcher<{ order: OrderView }>(`/api/orders/${encodeURIComponent(orderId)}`),
    {
      ...(initial ? { fallbackData: { order: initial } } : {}),
      revalidateOnMount: !initial,
      revalidateOnFocus: false,
      refreshInterval: (latest) => pollInterval(latest?.order),
      shouldRetryOnError: false,
    },
  );
  return {
    order: data?.order ?? initial ?? null,
    error: error as unknown,
    isLoading,
    notFound: error instanceof ApiError && error.status === 404,
    mutate: () => mutate(),
  };
}

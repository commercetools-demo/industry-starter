'use client';

import { useAccount } from '@/hooks/useAccount';
import { ApiError } from '@/hooks/fetcher';
import { useAccountSwr } from '@/hooks/useAccountSwr';
import { keyOrder } from '@/lib/cache-keys';
import type { OrderDetailView } from '@/lib/types';

/** Polling interval while a collect order is still being prepared. */
export const ORDER_POLL_MS = 30_000;

/**
 * One order of the signed-in customer by order number. `initial` (read on the server) avoids a second request on first
 * paint. Polls every 30 s only while a collect order is not yet collected.
 */
export function useOrder(orderNumber: string, initial?: OrderDetailView | null) {
  const { customer } = useAccount();
  const customerId = customer?.id ?? null;
  const { data, error, isLoading, mutate } = useAccountSwr<{ order: OrderDetailView }>(
    customerId ? keyOrder(customerId, orderNumber) : null,
    `/api/orders/number/${encodeURIComponent(orderNumber)}`,
    {
      ...(initial ? { fallbackData: { order: initial } } : {}),
      refreshInterval: (latest) =>
        latest?.order.hasCollect && latest.order.stateKey !== 'collected' && latest.order.status !== 'cancelled' ? ORDER_POLL_MS : 0,
    },
  );
  const notFound = error instanceof ApiError && error.status === 404;
  return { order: data?.order ?? null, isLoading: customer === undefined || isLoading, isError: Boolean(error), notFound, mutate, customerId };
}

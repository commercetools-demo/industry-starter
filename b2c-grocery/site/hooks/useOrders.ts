'use client';

import useSWR from 'swr';
import { KEY_PROFILE, keyOrder, keyOrdersPage } from '@/lib/cache-keys';
import { ApiError, fetchJson } from '@/lib/fetcher';
import type { AccountProfile, Order, OrderListItem } from '@/lib/types';

type OrdersResponse = { orders: OrderListItem[]; total: number; page?: number; pageSize?: number };

const DEFAULT_PAGE_SIZE = 10;
/** A missing or foreign order (404) or a signed-out session (401) will not change by retrying. */
const retryable = (error: unknown): boolean => !(error instanceof ApiError && error.status >= 400 && error.status < 500);

/** One page of the customer's orders (client-fetched, never cached by the server). Safe defaults: no orders, total 0. */
export function useOrders(page = 1) {
  const swr = useSWR<OrdersResponse>(keyOrdersPage(page), () => fetchJson<OrdersResponse>(`/api/account/orders?page=${page}`), {
    revalidateOnFocus: true,
    shouldRetryOnError: retryable,
  });
  return {
    ...swr,
    orders: swr.data?.orders ?? [],
    total: swr.data?.total ?? 0,
    pageSize: swr.data?.pageSize ?? DEFAULT_PAGE_SIZE,
  };
}

/** One order. `order` is `null` while loading and when it failed; `notFound` is true for a 404 (not found or not theirs). */
export function useOrder(id: string) {
  const swr = useSWR<Order>(keyOrder(id), async () => (await fetchJson<{ order: Order }>(`/api/account/orders/${encodeURIComponent(id)}`)).order, {
    shouldRetryOnError: retryable,
  });
  return { ...swr, order: swr.data ?? null, notFound: swr.error instanceof ApiError && swr.error.status === 404 };
}

/** The dashboard profile: name, member-since date and the default shipping address. */
export function useProfile() {
  const swr = useSWR<AccountProfile>(KEY_PROFILE, () => fetchJson<AccountProfile>('/api/account/profile'), { shouldRetryOnError: retryable });
  return { ...swr, profile: swr.data ?? null };
}

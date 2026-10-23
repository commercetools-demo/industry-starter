'use client';

import { useAccount } from '@/hooks/useAccount';
import { useAccountSwr } from '@/hooks/useAccountSwr';
import { keyOrdersPage } from '@/lib/cache-keys';
import type { OrderFilter, OrderView } from '@/lib/types';

export const ORDERS_PAGE_SIZE = 10;

export interface OrdersPage { orders: OrderView[]; total: number; limit: number; offset: number }

/** One page of the customer's orders for a filter (`page` is 1-based). The key carries the customer id, filter and page. */
export function useOrders(filter: OrderFilter, page: number) {
  const { customer } = useAccount();
  const customerId = customer?.id ?? null;
  const offset = (page - 1) * ORDERS_PAGE_SIZE;
  const { data, error, isLoading, mutate } = useAccountSwr<OrdersPage>(
    customerId ? keyOrdersPage(customerId, filter, page) : null,
    `/api/orders?filter=${filter}&limit=${ORDERS_PAGE_SIZE}&offset=${offset}`,
    { keepPreviousData: true },
  );
  return { data: data ?? null, isLoading: customer === undefined || isLoading, isError: Boolean(error), mutate, customerId };
}

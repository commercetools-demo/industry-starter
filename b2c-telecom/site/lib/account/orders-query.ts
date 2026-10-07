import { ORDER_STATUS_FILTER_KEYS, type OrderStatusFilter } from '@/lib/config/account';

// The query string of /account/orders. Pure: invalid input never throws, it reads as the default (all orders, page 1).

export function parseStatus(value: string | undefined): OrderStatusFilter {
  return ORDER_STATUS_FILTER_KEYS.find((key) => key === value) ?? 'all';
}

/** 1-based. Anything that is not a positive integer reads as 1. */
export function parsePage(value: string | undefined): number {
  if (value === undefined || !/^\d{1,6}$/.test(value)) return 1;
  const page = Number(value);
  return page >= 1 ? page : 1;
}

export function ordersHref(status: OrderStatusFilter, page: number): string {
  const params = new URLSearchParams();
  if (status !== 'all') params.set('status', status);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query === '' ? '/account/orders' : `/account/orders?${query}`;
}

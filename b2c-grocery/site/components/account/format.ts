import type { Order, OrderListItem, OrderStatus } from '@/lib/types';

/** Tag tone per order status (account-design "Orders table"); unknown states are neutral. */
export const STATUS_TONE: Record<OrderStatus, 'accent' | 'accent-2' | 'neutral'> = {
  processing: 'accent',
  packing: 'accent-2',
  'on-its-way': 'accent-2',
  delivered: 'neutral',
  cancelled: 'neutral',
  unknown: 'neutral',
};

/** The order number, or a short id (first 8 characters, prefixed with a hash sign) for orders that have none. */
export const orderLabel = (order: Pick<Order | OrderListItem, 'orderNumber' | 'id'>): string => order.orderNumber ?? `#${order.id.slice(0, 8)}`;

/** Order dates are shown in UTC so the day never depends on the browser's time zone. */
export const formatDate = (iso: string, locale: string): string =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(iso));

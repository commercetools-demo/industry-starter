import type { ReactElement } from 'react';
import { PanelUnavailable } from '@/components/account/PanelUnavailable';
import { RecentOrders } from '@/components/account/RecentOrders';
import { DASHBOARD_RECENT_ORDERS } from '@/lib/config/account';
import { mapOrderListItem } from '@/lib/mappers/order';
import type { Locale } from '@/lib/types';
import { attempt, loadOrders } from './load';

export async function RecentOrdersPanel({ customerId, locale }: { customerId: string; locale: Locale }): Promise<ReactElement> {
  const orders = await attempt('recent orders', async () => (await loadOrders(customerId, locale)).slice(0, DASHBOARD_RECENT_ORDERS).map(mapOrderListItem));
  return orders ? <RecentOrders orders={orders} /> : <PanelUnavailable />;
}

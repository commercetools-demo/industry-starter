// Server side of notifications (R-14): a registry of sources. Shipped now: order shipped. "Approval waiting" and
// "quote counter-offer" are not built (Q-V01); customer return received is a stub until workstream V registers it.
import 'server-only';
import { getPorts } from './seam';
import type { PortalNotification, PortalSession } from './types';

export interface NotificationSource {
  id: string;
  load(session: PortalSession): Promise<PortalNotification[]>;
}

const orderShipped: NotificationSource = {
  id: 'order-shipped',
  async load(session) {
    // The live port reads store orders with the admin client after authorizeStore, shipmentState Shipped in the last 7 days.
    const orders = await getPorts().shippedOrders(session);
    return orders.map((o) => ({ id: `order-shipped:${o.id}`, kind: 'order-shipped' as const, values: { order: o.orderNumber }, href: '/returns' }));
  },
};

const returnReceived: NotificationSource = { id: 'return-received', load: async () => [] };

const registry: NotificationSource[] = [orderShipped, returnReceived];

export const notificationSources = () => [...registry];

export function registerNotificationSource(source: NotificationSource): void {
  const index = registry.findIndex((s) => s.id === source.id);
  if (index >= 0) registry[index] = source;
  else registry.push(source);
}

export async function loadNotifications(session: PortalSession): Promise<PortalNotification[]> {
  const results = await Promise.allSettled(registry.map((s) => s.load(session)));
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}

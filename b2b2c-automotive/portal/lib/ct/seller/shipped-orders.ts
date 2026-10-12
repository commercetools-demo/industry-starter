import 'server-only';
import { authorizeStore } from '@/lib/authz/authorize-store';
import { adminRoot } from '@/lib/ct/admin-client';
import type { Session } from '@/lib/types';

export const SHIPPED_WINDOW_DAYS = 7;

/** Store orders whose shipment state is Shipped and that changed in the last 7 days (notification source, R-14). */
export async function listShippedOrders(session: Session, now: Date = new Date()): Promise<Array<{ id: string; orderNumber: string }>> {
  if (!session.storeKey) return [];
  await authorizeStore(session, session.storeKey, 'dashboard.view');
  const since = new Date(now.getTime() - SHIPPED_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { body } = await adminRoot
    .inStoreKeyWithStoreKeyValue({ storeKey: session.storeKey })
    .orders()
    .get({ queryArgs: { where: `shipmentState="Shipped" and lastModifiedAt > "${since}"`, sort: 'lastModifiedAt desc', limit: 10 } })
    .execute();
  return body.results.map((o) => ({ id: o.id, orderNumber: o.orderNumber ?? o.id }));
}

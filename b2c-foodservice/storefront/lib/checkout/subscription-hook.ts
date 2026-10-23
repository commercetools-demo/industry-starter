import type { OrderView } from '@/lib/types';

/**
 * Workstream N's post-order hook (K's `postOrderHooks`). The platform creates the recurring orders itself when an order with
 * recurring lines is placed (documented "Create Order from Cart", D-026 / spike N-02), so this hook creates nothing and never
 * touches the order. It writes one structured line (ids and counts only, no personal data) so a missing recurring order can be
 * traced from the order id. The account shows an order whose recurring order is missing as "Subscription pending".
 */
export async function logSubscriptionExpected(order: OrderView): Promise<void> {
  const lines = order.lines.filter((l) => l.recurrence !== null);
  if (lines.length === 0) return;
  const schedules = new Set(lines.map((l) => `${l.recurrence?.unit}:${l.recurrence?.value}`));
  console.info(JSON.stringify({ event: 'subscription_expected', orderId: order.id, subscribeLines: lines.length, schedules: schedules.size }));
}

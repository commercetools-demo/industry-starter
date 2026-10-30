import { isInstore } from '@/lib/app-mode';
import { logSubscriptionExpected } from '@/lib/checkout/subscription-hook';
import type { OrderView } from '@/lib/types';

/**
 * Hooks run once per order after it is finalised (workstream K). Workstream N registers its subscription hook here (the hosted
 * Checkout creates recurring orders itself from recurring lines; N's finding decides what the hook does). K left it empty; N registered `logSubscriptionExpected`. R registered `ensureOrderType` (In-store companion: sets `orderType` on an order that lacks it, D-042).
 * Each hook runs in its own try/catch in `finalizeOrder`: a failing hook is logged with the order id and never fails the order.
 */
export const postOrderHooks: Array<(order: OrderView) => Promise<void>> = [logSubscriptionExpected, tagOrderType];

/** R (D-042): in the In-store companion an order that lacks `orderType` gets it. Loaded on demand, so the website never imports it. */
async function tagOrderType(order: OrderView): Promise<void> {
  if (!isInstore()) return;
  const { ensureOrderType } = await import('@/lib/ct/order-type');
  await ensureOrderType(order);
}

import { logSubscriptionExpected } from '@/lib/checkout/subscription-hook';
import type { OrderView } from '@/lib/types';

/**
 * Hooks run once per order after it is finalised (workstream K). Workstream N registers its subscription hook here (the hosted
 * Checkout creates recurring orders itself from recurring lines; N's finding decides what the hook does). K left it empty; N registered `logSubscriptionExpected`.
 * Each hook runs in its own try/catch in `finalizeOrder`: a failing hook is logged with the order id and never fails the order.
 */
export const postOrderHooks: Array<(order: OrderView) => Promise<void>> = [logSubscriptionExpected];

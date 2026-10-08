import { AccountRefusal } from '@/lib/api/account-api';
import { orderActionRoute } from '@/lib/api/order-actions-api';
import { cancelOrder } from '@/lib/ct/post-purchase';
import { validateCancelInput } from '@/lib/orders/postPurchaseRules';

export const dynamic = 'force-dynamic';

/**
 * Cancels the whole order of the signed-in customer (D-040: until its service starts). The customer is the session's (D-070); a number
 * that is unknown, foreign or a guest's is the same 404. Monthly charges (recurring orders) are stopped before the order changes state.
 */
export async function POST(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  return orderActionRoute(request, params, 'CANCEL_FAILED', async ({ orderNumber, customerId, body, locale }) => {
    const checked = validateCancelInput(body);
    if (!checked.ok) throw new AccountRefusal(400, checked.code, 'The cancellation request is not valid');
    return cancelOrder(orderNumber, customerId, checked.value, locale);
  });
}

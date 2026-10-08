import { ApiError, handle, requireCustomer } from '@/lib/api';
import { AccountGoneError, getOverview } from '@/lib/ct/account-summary';

/**
 * GET /api/account/overview: the signed-in patient's overview. Each summary (labs, appointments, orders) resolves on
 * its own and reports `{ status: 'error' }` when its backing service is down. A signed-out session answers 401.
 */
export async function GET(): Promise<Response> {
  return handle(async () => {
    const { customerId } = await requireCustomer();
    try {
      return await getOverview(customerId);
    } catch (error) {
      if (error instanceof AccountGoneError) throw new ApiError(401, 'Please sign in to continue.');
      throw error;
    }
  });
}

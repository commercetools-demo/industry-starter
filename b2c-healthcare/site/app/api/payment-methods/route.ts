import { handle, requireCustomer } from '@/lib/api';
import { getPaymentProvider } from '@/lib/checkout/provider';
import { listMethods } from '@/lib/ct/payment-methods';
import { withProvider } from '@/lib/payment-route';

/**
 * GET /api/payment-methods: the signed-in customer's saved methods as descriptors (brand, last four digits, expiry,
 * default flag). The provider token never leaves the adapter. 401 without a session; never cached.
 */
export async function GET(): Promise<Response> {
  return handle(async () => {
    const session = await requireCustomer();
    return { methods: await withProvider(async () => listMethods(session.customerId, await getPaymentProvider())) };
  });
}

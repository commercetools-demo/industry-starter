import { ApiError, handle, requireCustomer } from '@/lib/api';
import { loadFakePaymentProvider } from '@/lib/ct/fixtures';

/**
 * POST /api/payment-methods/demo-add: DEVELOPMENT ONLY (`MALVA_FIXTURES=1`, fake payment provider). Saves a demo card
 * (Visa ending 4242, a descriptor: there is no card number anywhere) for the signed-in fixture customer so the page and
 * auto-refill can be checked without a payment service. Answers 404 everywhere else (including production).
 */
export async function POST(): Promise<Response> {
  return handle(async () => {
    const session = await requireCustomer();
    const fake = await loadFakePaymentProvider();
    if (!fake) throw new ApiError(404, 'Not found.');
    return fake.fakePaymentProvider.addStoredMethod(session.customerId, { brand: 'Visa', last4: '4242' });
  });
}

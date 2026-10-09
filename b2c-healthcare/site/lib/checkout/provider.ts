import 'server-only';
import { createCheckoutProvider } from '@/lib/ct/checkout-provider';
import type { PaymentProvider } from '@/lib/checkout/payment-provider';
import { loadFakePaymentProvider } from '@/lib/ct/fixtures';

/**
 * The payment provider for this process: the real Checkout adapter, or, only with `MALVA_FIXTURES=1` outside
 * production, the clearly labelled demo provider. The real adapter is created per call (cheap; it reads the
 * environment) and throws `PaymentUnavailableError` when Checkout is not configured.
 */
export async function getPaymentProvider(): Promise<PaymentProvider> {
  const fake = await loadFakePaymentProvider();
  if (fake) return fake.fakePaymentProvider;
  return createCheckoutProvider();
}

import 'server-only';
import { ApiError } from '@/lib/api';
import { PaymentUnavailableError, StoredMethodNotFoundError } from '@/lib/checkout/payment-provider';

/** One body and one status for a method that is not the signed-in customer's and for one that does not exist. */
export const METHOD_NOT_FOUND = 'Payment method not found.';

/**
 * Wraps a call to the payment provider: the provider's own errors become answers the buyer can read. The message of any
 * other error is never passed on (a provider error could echo a request); `handle()` sanitizes the rest.
 */
export async function withProvider<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof StoredMethodNotFoundError) throw new ApiError(404, METHOD_NOT_FOUND);
    if (error instanceof PaymentUnavailableError) throw new ApiError(503, error.message);
    throw error;
  }
}

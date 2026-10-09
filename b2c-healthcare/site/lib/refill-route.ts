import 'server-only';
import { ApiError } from '@/lib/api';
import { PaymentUnavailableError } from '@/lib/checkout/payment-provider';
import { AutoRefillError } from '@/lib/ct/auto-refill';
import { RecurringBusyError } from '@/lib/ct/recurring';

/** One body and one status for an auto-refill that is not the signed-in customer's and for one that does not exist. */
export const REFILL_NOT_FOUND = 'Auto-refill not found.';
export const refillNotFound = () => new ApiError(404, REFILL_NOT_FOUND);

const MESSAGES = {
  NO_PAYMENT_METHOD: 'Save a payment method first: refills are charged to it.',
  NOT_FOUND: 'We could not find that order or prescription.',
  NOTHING_REFILLABLE: 'There is nothing in this order that can be refilled.',
  NOT_DISPENSABLE: 'None of these medicines can be set up for auto-refill right now.',
  ALREADY_ENABLED: 'These medicines are already in an auto-refill.',
} as const;

const STATUS = { NO_PAYMENT_METHOD: 409, NOT_FOUND: 404, NOTHING_REFILLABLE: 422, NOT_DISPENSABLE: 422, ALREADY_ENABLED: 409 } as const;

/** Maps the errors of the auto-refill modules to answers the buyer can read; anything else is rethrown for `handle()`. */
export function refillErrorResponse(error: unknown): Response {
  if (error instanceof AutoRefillError) {
    return Response.json({ code: error.code, error: MESSAGES[error.code], ...(error.notIncluded.length > 0 ? { notIncluded: error.notIncluded } : {}) }, { status: STATUS[error.code] });
  }
  if (error instanceof RecurringBusyError) return Response.json({ code: 'BUSY', error: 'A refill is being prepared right now. Try again in a moment.' }, { status: 409 });
  if (error instanceof PaymentUnavailableError) return Response.json({ error: error.message }, { status: 503 });
  throw error;
}

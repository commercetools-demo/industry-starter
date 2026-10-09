import 'server-only';
import type { Order, Payment } from '@commercetools/platform-sdk';
import { withCartRetry } from '@/lib/api-retry';
import type { PaymentProvider } from '@/lib/checkout/payment-provider';
import { apiRoot } from '@/lib/ct/client';
import { restoreAuthorization } from '@/lib/ct/dispense-ledger';
import { loadCheckoutFixtures } from '@/lib/ct/fixtures';
import { restoreAllowance, restoreRestricted } from '@/lib/ct/order-cancel-hooks';
import { isInternalTender, returnCardPayments } from '@/lib/ct/payment-lifecycle';
import { getOrderForCustomer, getRawOrderForCustomer } from '@/lib/ct/orders-read';
import { paymentsOf, statusOfState } from '@/lib/mappers/order';
import { CANCELLABLE, type OrderView } from '@/lib/order-types';

export const ORDER_STATE_CANCELLED = 'mlv-cancelled';

export type CancelOutcome = { kind: 'cancelled'; order: OrderView; alreadyCancelled: boolean } | { kind: 'too-late' } | { kind: 'not-found' };

const statusCodeOf = (error: unknown): number | undefined => {
  const e = error as { statusCode?: unknown } | null;
  return typeof e?.statusCode === 'number' ? e.statusCode : undefined;
};

/** The platform refuses a transition the State machine does not define (packed-shipped has no way to cancelled). */
const isInvalidTransition = (error: unknown): boolean => statusCodeOf(error) === 400;

async function transitionToCancelled(orderId: string): Promise<'done' | 'too-late'> {
  try {
    await withCartRetry(async () => {
      const { body } = await apiRoot.orders().withId({ ID: orderId }).get().execute();
      await apiRoot.orders().withId({ ID: orderId }).post({ body: { version: body.version, actions: [{ action: 'transitionState', state: { typeId: 'state', key: ORDER_STATE_CANCELLED } }] } }).execute();
    });
    return 'done';
  } catch (error) {
    if (isInvalidTransition(error)) return 'too-late';
    throw error;
  }
}

/**
 * Internal tenders only (the allowance and the restricted instrument): the value goes back at once, so a `Success`
 * Refund transaction records the routing (the allowance balance itself is restored by `restoreAllowance`). A tender
 * that was never charged (the order was refused before settlement) has nothing to return. The CARD payment is not
 * modelled here at all: Checkout owns it and the refund or cancel goes through the PaymentProvider seam
 * (`payment-lifecycle.ts`). Idempotent.
 */
async function recordInternalReturn(payment: Payment): Promise<void> {
  if (payment.transactions.some((t) => t.type === 'Refund')) return;
  const charged = payment.transactions.find((t) => t.type === 'Charge' && t.state === 'Success');
  if (!charged) return;
  await withCartRetry(async () => {
    const { body } = await apiRoot.payments().withId({ ID: payment.id }).get().execute();
    if (body.transactions.some((t) => t.type === 'Refund')) return;
    await apiRoot
      .payments()
      .withId({ ID: payment.id })
      .post({ body: { version: body.version, actions: [{ action: 'addTransaction', transaction: { type: 'Refund', amount: { centAmount: charged.amount.centAmount, currencyCode: charged.amount.currencyCode }, state: 'Success' } }] } })
      .execute();
  });
}

/** Everything a cancelled order gives back. Every step is idempotent: a retried cancel finishes what a failed one left. */
async function giveBack(order: Order, provider: PaymentProvider | null): Promise<void> {
  await restoreAuthorization(order.id);
  await restoreAllowance(order.id);
  await restoreRestricted(order.id);
  const payments = paymentsOf(order);
  for (const payment of payments) if (isInternalTender(payment)) await recordInternalReturn(payment);
  await returnCardPayments(payments, provider);
}

/**
 * Cancels one of the customer's orders (`post-purchase-order-management`): allowed until `mlv-packed-shipped`
 *. Sets the State `mlv-cancelled`, gives the prescription refill back once (`restoreAuthorization` is
 * idempotent on the order id), calls the allowance and restricted-fund hooks (U), asks the payment service (through Checkout) to cancel the authorization or refund the capture. A foreign or unknown id is `not-found` (the same answer as for a read). Cancelling an
 * order that is already cancelled succeeds and re-runs the give-back steps, so a cancel that stopped half way is
 * completed by pressing the button again, and nothing is restored twice.
 */
export async function cancelOrderForCustomer(id: string, customerId: string, provider: PaymentProvider | null, locale: string): Promise<CancelOutcome> {
  const fixtures = await loadCheckoutFixtures();
  if (fixtures) return fixtures.cancelFixtureOrder(id, customerId);
  const order = await getRawOrderForCustomer(id, customerId);
  if (!order) return { kind: 'not-found' };
  const status = statusOfState(order.state?.obj?.key);
  const alreadyCancelled = status === 'cancelled';
  if (!alreadyCancelled) {
    if (!CANCELLABLE.includes(status)) return { kind: 'too-late' };
    if ((await transitionToCancelled(order.id)) === 'too-late') return { kind: 'too-late' };
  }
  await giveBack(order, provider);
  const view = await getOrderForCustomer(id, customerId, locale);
  return view ? { kind: 'cancelled', order: view, alreadyCancelled } : { kind: 'not-found' };
}

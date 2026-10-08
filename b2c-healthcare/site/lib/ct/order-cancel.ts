import 'server-only';
import type { Order, Payment } from '@commercetools/platform-sdk';
import { withCartRetry } from '@/lib/api-retry';
import type { PaymentProvider } from '@/lib/checkout/payment-provider';
import { apiRoot } from '@/lib/ct/client';
import { restoreAuthorization } from '@/lib/ct/dispense-ledger';
import { loadCheckoutFixtures } from '@/lib/ct/fixtures';
import { restoreAllowance, restoreRestricted } from '@/lib/ct/order-cancel-hooks';
import { METHOD_ALLOWANCE, METHOD_RESTRICTED } from '@/lib/funding/tender';
import { getOrderForCustomer, getRawOrderForCustomer } from '@/lib/ct/orders-read';
import { log } from '@/lib/log';
import { paymentsOf, statusOfState } from '@/lib/mappers/order';
import { CANCELLABLE, type OrderView } from '@/lib/order-types';

export const ORDER_STATE_CANCELLED = 'mlv-cancelled';
const INTERNAL_METHODS: readonly string[] = [METHOD_ALLOWANCE, METHOD_RESTRICTED];

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
 * Marks the payment for refund: one `Refund` transaction in state `Initial` for the authorized amount (Stripe's
 * sandbox refund is manual, so the Merchant Center / PSP dashboard moves it on; the order page shows "Refund
 * requested" while it is `Initial` or `Pending` and "Refunded" at `Success`). Idempotent: a payment that already has
 * a Refund transaction is left alone.
 */
async function markForRefund(payment: Payment): Promise<void> {
  if (payment.transactions.some((t) => t.type === 'Refund')) return;
  // Refund routing (workstream U): each Payment refunds its own instrument for the amount IT took. The allowance and the
  // restricted instrument are internal tenders: the value goes back at once (`Success`; the allowance balance is restored by
  // `restoreAllowance`), while the card share stays `Initial` for the payment service. A tender that was never charged
  // (the order was refused before settlement) has nothing to return.
  const internal = INTERNAL_METHODS.includes(payment.paymentMethodInfo?.method ?? '');
  const charged = payment.transactions.find((t) => t.type === 'Charge' && t.state === 'Success');
  if (internal && !charged) return;
  const authorized = payment.transactions.find((t) => t.type === 'Authorization' && t.state === 'Success');
  const amount = charged?.amount ?? authorized?.amount ?? payment.amountPlanned;
  const refundState = internal ? 'Success' : 'Initial';
  await withCartRetry(async () => {
    const { body } = await apiRoot.payments().withId({ ID: payment.id }).get().execute();
    if (body.transactions.some((t) => t.type === 'Refund')) return;
    await apiRoot
      .payments()
      .withId({ ID: payment.id })
      .post({ body: { version: body.version, actions: [{ action: 'addTransaction', transaction: { type: 'Refund', amount: { centAmount: amount.centAmount, currencyCode: amount.currencyCode }, state: refundState } }] } })
      .execute();
  });
}

/** Voids the authorization at the payment service (nothing was captured), when the service is configured. */
async function releasePayment(payment: Payment, provider: PaymentProvider | null): Promise<void> {
  if (!provider || !payment.transactions.some((t) => t.type === 'Authorization' && t.state === 'Success')) return;
  try {
    await provider.release(payment.id);
  } catch (error) {
    // The refund marker is already on the payment; an authorization that cannot be voided expires at the PSP.
    log.error('orders', 'could not release authorization', error instanceof Error ? error : { name: typeof error });
  }
}

/** Everything a cancelled order gives back. Every step is idempotent: a retried cancel finishes what a failed one left. */
async function giveBack(order: Order, provider: PaymentProvider | null): Promise<void> {
  await restoreAuthorization(order.id);
  await restoreAllowance(order.id);
  await restoreRestricted(order.id);
  for (const payment of paymentsOf(order)) {
    await markForRefund(payment);
    await releasePayment(payment, provider);
  }
}

/**
 * Cancels one of the customer's orders (`post-purchase-order-management`): allowed until `mlv-packed-shipped`
 * (Q-043). Sets the State `mlv-cancelled`, gives the prescription refill back once (`restoreAuthorization` is
 * idempotent on the order id), calls the allowance and restricted-fund hooks (U), marks the payment for refund and
 * voids the authorization. A foreign or unknown id is `not-found` (the same answer as for a read). Cancelling an
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

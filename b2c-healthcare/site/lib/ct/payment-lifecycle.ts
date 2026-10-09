import 'server-only';
import type { Payment } from '@commercetools/platform-sdk';
import type { PaymentProvider } from '@/lib/checkout/payment-provider';
import { METHOD_ALLOWANCE, METHOD_RESTRICTED } from '@/lib/funding/tender';
import { log } from '@/lib/log';

/**
 * What a cancelled or refused order gives back to the CARD payment (D-035). Checkout owns the payment lifecycle:
 * the storefront asks, through the `PaymentProvider` seam (Payment Intents API), and never writes its own Refund or
 * capture transactions on a card Payment. The connector records the result (CancelAuthorization, Refund) on the
 * Payment and the order page reads it back.
 *
 *  - something was captured (a `Charge` in state `Success`): ask for a refund of the charged amount;
 *  - only authorized: cancel the authorization ("Payment released": no money ever moved);
 *  - a Payment that already carries the request (a Refund or CancelAuthorization transaction) is left alone, so a
 *    retried cancel does not ask twice.
 * The allowance and the restricted instrument are internal tenders (`order-cancel.ts` handles their record).
 */

const INTERNAL: readonly string[] = [METHOD_ALLOWANCE, METHOD_RESTRICTED];

export const isInternalTender = (p: Pick<Payment, 'paymentMethodInfo'>): boolean => INTERNAL.includes(p.paymentMethodInfo?.method ?? '');

const requested = (state: string) => state === 'Success' || state === 'Pending' || state === 'Initial';

export type CardReturn = 'refund' | 'release' | 'none';

/** What would be asked of the payment service for this card Payment. */
export function returnFor(payment: Pick<Payment, 'transactions'>): CardReturn {
  const tx = payment.transactions;
  if (tx.some((t) => (t.type === 'Refund' || t.type === 'CancelAuthorization') && requested(t.state))) return 'none';
  if (tx.some((t) => t.type === 'Charge' && t.state === 'Success')) return 'refund';
  if (tx.some((t) => t.type === 'Authorization' && t.state === 'Success')) return 'release';
  return 'none';
}

/** Asks the payment service to refund or cancel each card Payment. A failure is logged (status only) and never hides the cancel. */
export async function returnCardPayments(payments: Payment[], provider: PaymentProvider | null): Promise<void> {
  if (!provider) return;
  for (const payment of payments) {
    if (isInternalTender(payment)) continue;
    const what = returnFor(payment);
    if (what === 'none') continue;
    try {
      if (what === 'release') await provider.release(payment.id);
      else {
        const charged = payment.transactions.filter((t) => t.type === 'Charge' && t.state === 'Success').reduce((sum, t) => sum + t.amount.centAmount, 0);
        await provider.refund(payment.id, { centAmount: charged, currencyCode: payment.amountPlanned.currencyCode });
      }
    } catch (error) {
      log.error('orders', `could not ${what} the card payment`, error instanceof Error ? error : { name: typeof error });
    }
  }
}

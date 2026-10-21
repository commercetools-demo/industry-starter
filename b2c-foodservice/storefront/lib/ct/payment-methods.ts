import 'server-only';
import type { PaymentMethod, PaymentMethodUpdateAction } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { updateWithRetry } from '@/lib/ct/retry';
import { AppError } from '@/lib/errors';

/**
 * Stored payment methods are created by the hosted Checkout (D-039, stored payment methods) as `PaymentMethod` resources of
 * the customer. We only read, deactivate and set the default; there is no add. The SDK namespace `paymentMethods()` exists in
 * @commercetools/platform-sdk 8.27 (checked for L-10).
 */
export async function listPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
  const { body } = await apiRoot
    .paymentMethods()
    .get({
      queryArgs: {
        where: 'customer(id=:c) and paymentMethodStatus="Active"',
        'var.c': customerId,
        sort: 'createdAt desc',
        limit: 20,
      },
    })
    .execute();
  return body.results;
}

const readOwned = async (customerId: string, id: string): Promise<PaymentMethod> => {
  let method: PaymentMethod;
  try {
    method = (await apiRoot.paymentMethods().withId({ ID: id }).get().execute()).body;
  } catch (e) {
    if ((e as { statusCode?: unknown } | null)?.statusCode === 404) throw new AppError('not_found', 404);
    throw e;
  }
  // Unknown, foreign and already removed are indistinguishable.
  if (method.customer?.id !== customerId || method.paymentMethodStatus !== 'Active') throw new AppError('not_found', 404);
  return method;
};

async function update(customerId: string, id: string, build: (m: PaymentMethod) => PaymentMethodUpdateAction[]): Promise<void> {
  await updateWithRetry(
    () => readOwned(customerId, id),
    async (current) => {
      const actions = build(current);
      if (actions.length === 0) return;
      await apiRoot.paymentMethods().withId({ ID: id }).post({ body: { version: current.version, actions } }).execute();
    },
  );
}

/**
 * Remove = set `Inactive` (history stays readable). The token at the payment service is NOT revoked (Q-L-14). A default
 * method cannot be made inactive (documented), so it is made non-default in the same update and NOTHING is promoted: the
 * shopper chooses a new default.
 */
export async function removePaymentMethod(customerId: string, id: string): Promise<void> {
  await update(customerId, id, (m) => [
    ...(m.default ? ([{ action: 'setDefault', default: false }] as PaymentMethodUpdateAction[]) : []),
    { action: 'setPaymentMethodStatus', paymentMethodStatus: 'Inactive' },
  ]);
}

/** Set default: the current default is cleared first, then the chosen one is set (two updates, in that order). */
export async function setDefaultPaymentMethod(customerId: string, id: string): Promise<void> {
  await readOwned(customerId, id);
  const current = (await listPaymentMethods(customerId)).find((m) => m.default && m.id !== id);
  if (current) await update(customerId, current.id, () => [{ action: 'setDefault', default: false }]);
  await update(customerId, id, (m) => (m.default ? [] : [{ action: 'setDefault', default: true }]));
}

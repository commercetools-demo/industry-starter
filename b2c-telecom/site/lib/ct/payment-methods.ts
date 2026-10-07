import 'server-only';
import type { PaymentMethod, PaymentMethodUpdateAction } from '@commercetools/platform-sdk';
import { PAYMENT_METHODS_LIMIT } from '@/lib/config/payment-methods';
import { getApiRoot } from './client';
import { withTimeout } from './timeout';

// Stored payment methods of the signed-in customer (D-032 list-only; D-070 no /me endpoints). There is no /me/payment-methods, so the
// storefront client reads and writes the records and THIS module is the ownership check: every function takes the customer id from the
// session and never trusts a record id from the client. Never cached.

export class PaymentMethodNotFoundError extends Error {
  constructor() {
    super('Payment method not found');
    this.name = 'PaymentMethodNotFoundError';
  }
}

/** The storefront client has no `view_payment_methods` / `manage_payment_methods` scope (OA-02 lacks them): the page says "unavailable". */
export class PaymentMethodsForbiddenError extends Error {
  constructor() {
    super('The storefront client may not use payment methods');
    this.name = 'PaymentMethodsForbiddenError';
  }
}

const statusOf = (error: unknown): number | undefined =>
  typeof error === 'object' && error !== null && 'statusCode' in error && typeof (error as { statusCode: unknown }).statusCode === 'number' ? (error as { statusCode: number }).statusCode : undefined;

/** Anything that is not a commercetools id would be a way into the query predicate: refuse it before any request. */
const CUSTOMER_ID = /^[0-9a-f-]{36}$/;

async function call<T>(label: string, run: () => Promise<{ body: T }>): Promise<T> {
  try {
    return (await withTimeout(run(), label)).body;
  } catch (error) {
    const status = statusOf(error);
    if (status === 403) throw new PaymentMethodsForbiddenError();
    if (status === 404) throw new PaymentMethodNotFoundError();
    throw error;
  }
}

/** Active records of the customer, newest first (at most 50 can be active). */
export async function listPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
  if (!CUSTOMER_ID.test(customerId)) throw new Error('Invalid customer id');
  const body = await call('paymentMethods.list', () =>
    getApiRoot()
      .paymentMethods()
      .get({ queryArgs: { where: `customer(id="${customerId}") and paymentMethodStatus="Active"`, limit: PAYMENT_METHODS_LIMIT, sort: 'createdAt desc' } })
      .execute(),
  );
  // Belt and braces: whatever the predicate returned, only this customer's records leave this module.
  return body.results.filter((pm) => pm.customer?.id === customerId);
}

async function post(id: string, version: number, actions: PaymentMethodUpdateAction[]): Promise<PaymentMethod> {
  return call('paymentMethods.update', () => getApiRoot().paymentMethods().withId({ ID: id }).post({ body: { version, actions } }).execute());
}

/** One update of one record with its own version; a version conflict re-reads THAT record and retries once. */
async function update(pm: PaymentMethod, actions: PaymentMethodUpdateAction[]): Promise<PaymentMethod> {
  try {
    return await post(pm.id, pm.version, actions);
  } catch (error) {
    if (statusOf(error) !== 409) throw error;
    const fresh = await call('paymentMethods.get', () => getApiRoot().paymentMethods().withId({ ID: pm.id }).get().execute());
    return post(fresh.id, fresh.version, actions);
  }
}

/**
 * Makes one record the default. The docs define `setDefault` only as a per-record boolean and do not say the platform clears the
 * previous default, so the previous default(s) are cleared FIRST (a failure in between leaves no default, never two).
 */
export async function setDefaultPaymentMethod(customerId: string, id: string): Promise<void> {
  const methods = await listPaymentMethods(customerId);
  const target = methods.find((pm) => pm.id === id);
  if (!target) throw new PaymentMethodNotFoundError();
  for (const other of methods.filter((pm) => pm.default && pm.id !== id)) {
    await update(other, [{ action: 'setDefault', default: false }]);
  }
  if (!target.default) await update(target, [{ action: 'setDefault', default: true }]);
}

/**
 * Removes a record by making it Inactive (not a hard delete: Payments may reference the instrument and the history stays). A default
 * record gives up its flag in the same update; no other record is promoted. Only the owning customer can remove it.
 */
export async function removePaymentMethod(customerId: string, id: string): Promise<void> {
  const methods = await listPaymentMethods(customerId);
  const target = methods.find((pm) => pm.id === id);
  if (!target) throw new PaymentMethodNotFoundError();
  const actions: PaymentMethodUpdateAction[] = [...(target.default ? [{ action: 'setDefault' as const, default: false }] : []), { action: 'setPaymentMethodStatus', paymentMethodStatus: 'Inactive' }];
  await update(target, actions);
}

import 'server-only';
import type { Order as CtOrder } from '@commercetools/platform-sdk';
import { mapOrder } from '@/lib/mappers/order';
import { postPurchaseNow } from '@/lib/orders/now';
import { buildCancelActions, cancelEligibility, type CancelBlock } from '@/lib/orders/postPurchaseRules';
import type { CancelReason, Locale, Order } from '@/lib/types';
import { getApiRoot } from './client';
import { getRecurringOrdersForOrder, setRecurringOrderState } from './recurring';
import { withTimeout } from './timeout';

// Post-purchase writes of the signed-in customer (V): cancel the whole order before its service starts, and request the return of a
// device. Every function takes the customer id from the SESSION and refuses an order that is not theirs (D-070: no /me endpoints).
// Nothing here refunds money or moves goods (D-040): the platform's order and recurring-order states are the record.

export class OrderNotFoundError extends Error {
  constructor() {
    super('Order not found');
    this.name = 'OrderNotFoundError';
  }
}

export class NotCancellableError extends Error {
  constructor(readonly block: CancelBlock) {
    super(`Order cannot be cancelled online: ${block}`);
    this.name = 'NotCancellableError';
  }
}

const statusOf = (error: unknown): number | undefined =>
  typeof error === 'object' && error !== null && 'statusCode' in error && typeof (error as { statusCode: unknown }).statusCode === 'number' ? (error as { statusCode: number }).statusCode : undefined;

/** The raw order with this number when it belongs to `customerId`, else `null` (unknown, another customer's and guest orders look alike). */
export async function getOwnedOrder(orderNumber: string, customerId: string): Promise<CtOrder | null> {
  try {
    const { body } = await withTimeout(
      getApiRoot()
        .orders()
        .withOrderNumber({ orderNumber })
        .get({ queryArgs: { expand: ['custom.type'] } })
        .execute(),
      'postPurchase.order',
    );
    if (!body.customerId || body.customerId !== customerId) return null;
    return body;
  } catch (error) {
    if (statusOf(error) === 404) return null;
    throw error;
  }
}

/** Key of the order's custom type (read with `expand=custom.type`), null when the order has none. */
export function customTypeKeyOf(order: CtOrder): string | null {
  const type = order.custom?.type as { obj?: { key?: string } } | undefined;
  return type?.obj?.key ?? null;
}

export function customFieldText(order: CtOrder, name: string): string | null {
  const value = (order.custom?.fields as Record<string, unknown> | undefined)?.[name];
  return typeof value === 'string' ? value : null;
}

/** Stops the monthly charges: every recurring order of the order that is not already cancelled. Throws on the first failure. */
async function cancelRecurringOrders(orderId: string): Promise<void> {
  const recurring = await getRecurringOrdersForOrder(orderId, { locale: 'en-US', currency: 'USD' });
  for (const entry of recurring) {
    if (entry.state === 'Canceled') continue;
    await setRecurringOrderState(entry.id, 'canceled', 'customer-cancelled-order');
  }
}

/**
 * Cancels the whole order. Idempotent: an order that is already cancelled is returned as it is. The recurring orders are cancelled FIRST
 * (`changeOrderState` does not touch them, the customer would still be billed); if any of that fails nothing else has changed and the
 * call can simply be repeated. A version conflict re-reads the order and re-checks eligibility once. The note is never logged.
 */
export async function cancelOrder(orderNumber: string, customerId: string, input: { reason: CancelReason; note?: string }, locale: Locale): Promise<Order> {
  for (let attempt = 0; ; attempt += 1) {
    const order = await getOwnedOrder(orderNumber, customerId);
    if (!order) throw new OrderNotFoundError();
    const mapped = mapOrder(order, locale);
    if (order.orderState === 'Cancelled') return mapped;
    const now = postPurchaseNow();
    const eligibility = cancelEligibility(mapped, now);
    if (!eligibility.allowed) throw new NotCancellableError(eligibility.block);

    await cancelRecurringOrders(order.id);
    try {
      const { body } = await withTimeout(
        getApiRoot()
          .orders()
          .withId({ ID: order.id })
          .post({ queryArgs: { expand: ['custom.type'] }, body: { version: order.version, actions: buildCancelActions({ customTypeKey: customTypeKeyOf(order) }, input, now) } })
          .execute(),
        'postPurchase.cancel',
      );
      return mapOrder(body, locale);
    } catch (error) {
      if (statusOf(error) === 409 && attempt === 0) continue;
      throw error;
    }
  }
}

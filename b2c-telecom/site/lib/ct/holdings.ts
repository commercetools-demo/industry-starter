import 'server-only';
import { cache } from 'react';
import { deriveHoldings, type HoldingOrder, type HoldingRecurringOrder } from '@/lib/offers/holdings';
import type { HeldService, Offer } from '@/lib/types';
import { getApiRoot } from './client';
import { withTimeout } from './timeout';

// Held services = the signed-in customer's orders and recurring orders (D-021). Session-specific data: never cache these reads
// across requests; React `cache` only deduplicates inside one request.

const PAGE = 100;
const text = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined);
/** The id comes from the signed session, but is still stripped of the characters that could break out of the predicate. */
const sanitize = (id: string): string => id.replace(/["\\]/g, '');

interface LineLike {
  productKey?: string;
  custom?: { fields?: unknown };
}

/** The line's offer key: the custom field copied from the cart line, else the offer product's key. */
function offerKeysOf(lines: LineLike[] | undefined): string[] {
  return (lines ?? []).flatMap((line) => {
    const fields = line.custom?.fields as Record<string, unknown> | undefined;
    const key = text(fields?.offerKey) ?? text(line.productKey);
    return key === undefined ? [] : [key];
  });
}

const statusOf = (error: unknown): number | undefined =>
  typeof error === 'object' && error !== null && 'statusCode' in error && typeof (error as { statusCode: unknown }).statusCode === 'number'
    ? (error as { statusCode: number }).statusCode
    : undefined;

let recurringUnavailableLogged = false;

async function readOrders(customerId: string): Promise<HoldingOrder[]> {
  const { body } = await withTimeout(
    getApiRoot()
      .orders()
      .get({ queryArgs: { where: `customerId="${sanitize(customerId)}"`, sort: 'createdAt desc', limit: PAGE } })
      .execute(),
    'holdings.orders',
  );
  return body.results.map((order) => ({ orderNumber: order.orderNumber ?? order.id, orderState: order.orderState, offerKeys: offerKeysOf(order.lineItems) }));
}

async function readRecurringOrders(customerId: string): Promise<HoldingRecurringOrder[]> {
  try {
    const { body } = await withTimeout(
      getApiRoot()
        .recurringOrders()
        .get({ queryArgs: { where: `customer(id="${sanitize(customerId)}")`, sort: 'createdAt desc', limit: PAGE, expand: ['cart'] } })
        .execute(),
      'holdings.recurring-orders',
    );
    return body.results.map((recurringOrder) => ({ id: recurringOrder.id, state: recurringOrder.recurringOrderState, offerKeys: offerKeysOf(recurringOrder.cart.obj?.lineItems) }));
  } catch (error) {
    // Without the view_recurring_orders scope (OA-02) the read is refused: degrade to orders only, never fail the page.
    const status = statusOf(error);
    if (status === 403 || status === 404) {
      if (!recurringUnavailableLogged) {
        recurringUnavailableLogged = true;
        console.error(`holdings: recurring orders unavailable (HTTP ${status}); using orders only`);
      }
      return [];
    }
    throw error;
  }
}

const readRaw = cache(async (customerId: string) => {
  const [orders, recurring] = await Promise.all([readOrders(customerId), readRecurringOrders(customerId)]);
  return { orders, recurring };
});

/** What the customer holds right now. Anonymous visitors hold nothing (callers do not call this without a customerId). */
export async function getHoldings(customerId: string, offersByKey: Record<string, Offer>): Promise<HeldService[]> {
  const { orders, recurring } = await readRaw(customerId);
  return deriveHoldings(orders, recurring, offersByKey);
}

/** Test seam. */
export function resetHoldingsLogForTests(): void {
  recurringUnavailableLogged = false;
}

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The shopper's orders and returns (workstream Q-06, Q-07). Every read is in the store scope and filtered by the session's `customerId`;
// an order of another customer is `null` (the page answers 404). Returns follow the portal's contract (`lib/account/returns.ts`).
import 'server-only';
import type { Order } from '@commercetools/platform-sdk';
import { AccountError, errorCodes, safeId, statusOf } from '@/lib/account/errors';
import { buildReturnAction, returnEligibility, type ReturnableOrder } from '@/lib/account/returns';
import { ORDER_NUMBER_FORMAT } from '@/lib/checkout/order-number';
import { isReturnReason } from '@/lib/contracts/return-item';
import { inStore } from '@/lib/ct/in-store';
import { mapOrderListItem, mapReturns } from '@/lib/mappers/account';
import { ORDER_CONFIRMATION_EXPAND } from '@/lib/mappers/order';
import type { OrderListPage, ReturnView } from '@/lib/types';

/** Shipping method and state are expanded because the status words (pickup, ready for pickup) need them. */
const LIST_EXPAND = ['shippingInfo.shippingMethod', 'state'];
export const PAGE_SIZE = 10;

export async function listOrders(storeKey: string, customerId: string, options: { page?: number; pageSize?: number } = {}): Promise<OrderListPage> {
  const pageSize = Math.min(Math.max(options.pageSize ?? PAGE_SIZE, 1), 50);
  const page = Math.max(options.page ?? 1, 1);
  const { body } = await inStore(storeKey)
    .orders()
    .get({ queryArgs: { where: `customerId="${safeId(customerId)}"`, sort: 'createdAt desc', limit: pageSize, offset: (page - 1) * pageSize, withTotal: true, expand: LIST_EXPAND } })
    .execute();
  return { items: body.results.map(mapOrderListItem), page, pageSize, total: body.total ?? body.results.length };
}

/** The most recent orders as commercetools has them (the overview reads status and pickup branch from them). */
export async function listRecentOrders(storeKey: string, customerId: string, limit = 10): Promise<Order[]> {
  const { body } = await inStore(storeKey)
    .orders()
    .get({ queryArgs: { where: `customerId="${safeId(customerId)}"`, sort: 'createdAt desc', limit, expand: LIST_EXPAND } })
    .execute();
  return body.results;
}

/** The order with this number when it belongs to this customer in this store, else `null` (malformed number, unknown, someone else's). */
export async function getAccountOrder(storeKey: string, customerId: string, orderNumber: string): Promise<Order | null> {
  if (!ORDER_NUMBER_FORMAT.test(orderNumber)) return null;
  try {
    const { body } = await inStore(storeKey).orders().withOrderNumber({ orderNumber }).get({ queryArgs: { expand: ORDER_CONFIRMATION_EXPAND } }).execute();
    return body.customerId === customerId ? body : null;
  } catch (error) {
    if (statusOf(error) === 404) return null;
    throw error;
  }
}

export interface ReturnInput {
  items: Array<{ lineItemId: string; quantity: number }>;
  reason: string;
  comment?: string;
}

const PROBLEM_CODE = { 'not-delivered': 'NOT_DELIVERED', 'window-closed': 'RETURN_WINDOW_CLOSED', 'nothing-left': 'NOTHING_LEFT' } as const;

/**
 * Records a return: `addReturnInfo` with `shipmentState: 'Advised'` and the `malva-return-item` fields the portal reads. Refused (409) when the
 * order is not delivered, past the window (`returnWindowDays` of the store, 30 days from `deliveredAt`) or has nothing left to return; 400 for an
 * unknown line, a quantity above what is left or a reason outside the portal's list. One retry on a version conflict (the data is re-checked).
 */
export async function requestReturn(
  storeKey: string,
  customerId: string,
  orderNumber: string,
  input: ReturnInput,
  options: { windowDays?: number | null; locale?: string; now?: Date } = {},
): Promise<{ returnNumber: string; tracking: string }> {
  if (!isReturnReason(input.reason)) throw new AccountError('invalid-reason');
  if (input.items.length === 0) throw new AccountError('no-items');
  const now = options.now ?? new Date();
  for (let attempt = 0; ; attempt += 1) {
    const order = await getAccountOrder(storeKey, customerId, orderNumber);
    if (!order) throw new AccountError('not-found', 404);
    const returnable = order as unknown as ReturnableOrder;
    const eligibility = returnEligibility(returnable, { now, locale: options.locale ?? 'en-US', windowDays: options.windowDays });
    if (!eligibility.eligible && eligibility.problem) throw new AccountError(PROBLEM_CODE[eligibility.problem], 409);
    const wanted = new Map<string, number>();
    for (const item of input.items) wanted.set(item.lineItemId, (wanted.get(item.lineItemId) ?? 0) + item.quantity);
    for (const [lineItemId, quantity] of wanted) {
      const line = eligibility.lines.find((l) => l.lineItemId === lineItemId);
      if (!line) throw new AccountError('invalid-line');
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > line.remaining) throw new AccountError('quantity-exceeds');
    }
    const action = buildReturnAction(returnable, { items: [...wanted].map(([lineItemId, quantity]) => ({ lineItemId, quantity })), reason: input.reason, ...(input.comment ? { comment: input.comment } : {}) }, now);
    try {
      await inStore(storeKey).orders().withOrderNumber({ orderNumber }).post({ body: { version: order.version, actions: [action] } }).execute();
      return { returnNumber: action.items[0].custom.fields.returnNumber, tracking: action.returnTrackingId };
    } catch (error) {
      if (statusOf(error) === 409 && attempt < 1) continue;
      if (statusOf(error) === 400 && errorCodes(error).some((c) => c === 'InvalidField' || c === 'InvalidOperation')) throw new AccountError('return-refused');
      throw error;
    }
  }
}

/** The returns of the customer's recent orders, newest first. */
export async function listReturns(storeKey: string, customerId: string, locale: string): Promise<ReturnView[]> {
  const { body } = await inStore(storeKey)
    .orders()
    .get({ queryArgs: { where: `customerId="${safeId(customerId)}"`, sort: 'lastModifiedAt desc', limit: 100 } })
    .execute();
  return body.results.flatMap((order) => mapReturns(order, locale)).sort((a, b) => (b.requestedAt ?? '').localeCompare(a.requestedAt ?? ''));
}

import 'server-only';
import type { RecurringOrder, RecurringOrderUpdateAction } from '@commercetools/platform-sdk';
import { isRecurrencePolicyKey } from '../config/features';
import { mapRecurringOrder } from '../mappers/recurring-order';
import { nextOccurrence } from '../recurrence-schedule';
import type { RecurringOrderSummary } from '../types';
import { getApiRoot } from './client';

/** The Recurring Order and its recurring cart (items), the cadence name and the first order (date of the last order). */
const EXPAND = ['cart', 'cart.lineItems[*].recurrenceInfo.recurrencePolicy', 'originOrder'];

export class RecurringOrderNotFoundError extends Error {
  constructor(id: string) {
    super(`Recurring order ${id} not found`);
    this.name = 'RecurringOrderNotFoundError';
  }
}
export class RecurringOrderLineNotFoundError extends Error {
  constructor(lineId: string) {
    super(`Line ${lineId} is not part of the recurring order`);
    this.name = 'RecurringOrderLineNotFoundError';
  }
}
/** The action does not fit the current state (for example resume of an Active one, or any change of a Canceled one). */
export class RecurringOrderStateError extends Error {
  constructor(public readonly state: string) {
    super(`Not allowed while the recurring order is ${state}`);
    this.name = 'RecurringOrderStateError';
  }
}
export class UnknownPolicyError extends Error {
  constructor(key: string) {
    super(`Unknown recurrence policy ${key}`);
    this.name = 'UnknownPolicyError';
  }
}

const statusOf = (e: unknown): number | undefined => {
  if (typeof e !== 'object' || e === null) return undefined;
  const { statusCode, code } = e as { statusCode?: unknown; code?: unknown };
  return typeof statusCode === 'number' ? statusCode : typeof code === 'number' ? code : undefined;
};

/** The id is interpolated into a predicate: it comes from the signed session, but strip quotes anyway. */
const safe = (value: string): string => value.replace(/["\\]/g, '');

/** All Recurring Orders of the customer, newest first. */
export async function getRecurringOrders(customerId: string, locale: string): Promise<RecurringOrderSummary[]> {
  const { body } = await getApiRoot()
    .recurringOrders()
    .get({ queryArgs: { where: `customer(id="${safe(customerId)}")`, sort: 'createdAt desc', limit: 100, expand: EXPAND } })
    .execute();
  return body.results.map((ro) => mapRecurringOrder(ro, { locale }));
}

/** The SDK object when it exists and belongs to the customer (a stranger's one answers exactly like a missing one). */
async function loadOwned(id: string, customerId: string): Promise<RecurringOrder | null> {
  try {
    const { body } = await getApiRoot().recurringOrders().withId({ ID: id }).get({ queryArgs: { expand: EXPAND } }).execute();
    return body.customer?.id === customerId ? body : null;
  } catch (e) {
    if (statusOf(e) === 404) return null;
    throw e;
  }
}

/** One Recurring Order of the customer, `null` when it does not exist or is not theirs. */
export async function getRecurringOrder(id: string, customerId: string, locale: string): Promise<RecurringOrderSummary | null> {
  const ro = await loadOwned(id, customerId);
  return ro ? mapRecurringOrder(ro, { locale }) : null;
}

async function owned(id: string, customerId: string): Promise<RecurringOrder> {
  const ro = await loadOwned(id, customerId);
  if (!ro) throw new RecurringOrderNotFoundError(id);
  return ro;
}

const isLive = (ro: RecurringOrder) => ro.recurringOrderState === 'Active' || ro.recurringOrderState === 'Paused';

/** Runs `fn` with the freshly loaded Recurring Order; one retry on a version conflict (409). */
async function withRetry(id: string, customerId: string, fn: (ro: RecurringOrder) => Promise<unknown>): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    const ro = await owned(id, customerId);
    try {
      await fn(ro);
      return;
    } catch (e) {
      if (statusOf(e) !== 409 || attempt >= 1) throw e;
    }
  }
}

const update = (ro: RecurringOrder, actions: RecurringOrderUpdateAction[]) =>
  getApiRoot().recurringOrders().withId({ ID: ro.id }).post({ body: { version: ro.version, actions } }).execute();

async function refreshed(id: string, customerId: string, locale: string): Promise<RecurringOrderSummary> {
  const summary = await getRecurringOrder(id, customerId, locale);
  if (!summary) throw new RecurringOrderNotFoundError(id);
  return summary;
}

/** Changes the schedule of the same Recurring Order (`setSchedule`); the API moves the recurring cart's lines to the policy too. */
export async function setCadence(id: string, customerId: string, policyKey: string, locale: string): Promise<RecurringOrderSummary> {
  if (!isRecurrencePolicyKey(policyKey)) throw new UnknownPolicyError(policyKey);
  await withRetry(id, customerId, (ro) => {
    if (!isLive(ro)) throw new RecurringOrderStateError(ro.recurringOrderState);
    return update(ro, [{ action: 'setSchedule', recurrencePolicy: { typeId: 'recurrence-policy', key: policyKey } }]);
  });
  return refreshed(id, customerId, locale);
}

/** Changes the quantity of one item. The items live in the recurring cart, so this is `changeLineItemQuantity` on that cart. */
export async function setQuantity(id: string, customerId: string, lineId: string, quantity: number, locale: string): Promise<RecurringOrderSummary> {
  if (!Number.isInteger(quantity) || quantity < 1) throw new RangeError('quantity must be a whole number of at least 1');
  await withRetry(id, customerId, (ro) => {
    if (!isLive(ro)) throw new RecurringOrderStateError(ro.recurringOrderState);
    const cart = ro.cart.obj;
    if (!cart || !cart.lineItems.some((l) => l.id === lineId)) throw new RecurringOrderLineNotFoundError(lineId);
    return getApiRoot()
      .carts()
      .withId({ ID: cart.id })
      .post({ body: { version: cart.version, actions: [{ action: 'changeLineItemQuantity', lineItemId: lineId, quantity }] } })
      .execute();
  });
  return refreshed(id, customerId, locale);
}

export async function pause(id: string, customerId: string, locale: string): Promise<RecurringOrderSummary> {
  await withRetry(id, customerId, (ro) => {
    if (ro.recurringOrderState !== 'Active') throw new RecurringOrderStateError(ro.recurringOrderState);
    return update(ro, [{ action: 'setRecurringOrderState', recurringOrderState: { type: 'paused' } }]);
  });
  return refreshed(id, customerId, locale);
}

/**
 * Resumes a paused one. A plain resume would put `nextOrderAt` back to `startsAt` (in the past) and order at once, so the
 * next scheduled date after now is passed as `resumesAt` (PROJECT-FINDINGS §19).
 */
export async function resume(id: string, customerId: string, locale: string, now: Date = new Date()): Promise<RecurringOrderSummary> {
  await withRetry(id, customerId, (ro) => {
    if (ro.recurringOrderState !== 'Paused') throw new RecurringOrderStateError(ro.recurringOrderState);
    const resumesAt = nextOccurrence(ro.startsAt, ro.schedule, now);
    return update(ro, [{ action: 'setRecurringOrderState', recurringOrderState: { type: 'active', ...(resumesAt ? { resumesAt } : {}) } }]);
  });
  return refreshed(id, customerId, locale);
}

/** Cancels it for good (no more orders). The returned summary has `lastOrderAt`: the last generated order, else the first one. */
export async function cancel(id: string, customerId: string, locale: string): Promise<RecurringOrderSummary> {
  await withRetry(id, customerId, (ro) => {
    if (!isLive(ro)) throw new RecurringOrderStateError(ro.recurringOrderState);
    return update(ro, [{ action: 'setRecurringOrderState', recurringOrderState: { type: 'canceled' } }]);
  });
  return refreshed(id, customerId, locale);
}

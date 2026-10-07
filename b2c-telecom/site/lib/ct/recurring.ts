import 'server-only';
import type { CartUpdateAction, OrderUpdateAction, RecurringOrder, RecurringOrderUpdateAction } from '@commercetools/platform-sdk';
import { unstable_cache } from 'next/cache';
import { ApiError } from '@/lib/api-error';
import { RECURRENCE_POLICY_TTL_S } from '@/lib/config/cache';
import { MONTHLY_POLICY_KEY } from '@/lib/config/pricing';
import { mapRecurringOrder, type MapContext } from '@/lib/mappers/recurringOrder';
import type { LineRecurrence, PriceSelectionMode, RecurringOrderSummary } from '@/lib/types';
import { getApiRoot } from './client';
import { withTimeout } from './timeout';

/**
 * ApiError codes are a closed set (E), so the L-specific reasons travel in `details.reason`:
 * RECURRENCE_POLICY_MISSING (INTERNAL), RECURRING_PRICE_MISSING (VALIDATION), RECURRING_ORDER_BUSY (CONFLICT).
 */
export const RECURRING_REASON = {
  POLICY_MISSING: 'RECURRENCE_POLICY_MISSING',
  PRICE_MISSING: 'RECURRING_PRICE_MISSING',
  ORDER_BUSY: 'RECURRING_ORDER_BUSY',
} as const;

export interface RecurrencePolicyRef {
  id: string;
  key: string;
  version: number;
}

function statusOf(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null) {
    const e = err as { statusCode?: unknown; code?: unknown };
    if (typeof e.statusCode === 'number') return e.statusCode;
    if (typeof e.code === 'number') return e.code;
  }
  return undefined;
}

/** GET /recurrence-policies/key=malva-monthly, cached RECURRENCE_POLICY_TTL_S. Throws RECURRENCE_POLICY_MISSING when absent. */
export async function getMonthlyPolicy(): Promise<RecurrencePolicyRef> {
  const read = unstable_cache(
    async (): Promise<RecurrencePolicyRef | null> => {
      try {
        const { body } = await withTimeout(getApiRoot().recurrencePolicies().withKey({ key: MONTHLY_POLICY_KEY }).get().execute(), 'recurring.policy');
        return { id: body.id, key: body.key ?? MONTHLY_POLICY_KEY, version: body.version };
      } catch (err) {
        if (statusOf(err) === 404) return null;
        throw err;
      }
    },
    ['recurrence-policy', MONTHLY_POLICY_KEY],
    { revalidate: RECURRENCE_POLICY_TTL_S },
  );
  const policy = await read();
  if (!policy) {
    throw new ApiError('INTERNAL', `Recurrence policy ${MONTHLY_POLICY_KEY} not found`, { reason: RECURRING_REASON.POLICY_MISSING });
  }
  return policy;
}

/** The `recurrenceInfo` of an `addLineItem` action (also `setLineItemRecurrenceInfo`). */
export function recurrenceInfoDraft(r: LineRecurrence): {
  recurrencePolicy: { typeId: 'recurrence-policy'; key: string };
  priceSelectionMode: PriceSelectionMode;
} {
  return { recurrencePolicy: { typeId: 'recurrence-policy', key: r.policyKey }, priceSelectionMode: r.priceSelectionMode };
}

/**
 * A recurring line whose variant has no price tied to the policy silently gets the one-time price. Call after addLineItem
 * and fail the add when the price carries no (or another) recurrence policy.
 */
export function assertRecurringPrice(line: { price?: { recurrencePolicy?: { id: string } } }, policy: RecurrencePolicyRef, sku: string): void {
  if (line.price?.recurrencePolicy?.id !== policy.id) {
    throw new ApiError('VALIDATION', `No recurring price for ${sku}`, { reason: RECURRING_REASON.PRICE_MISSING, sku });
  }
}

// ---- part 2: recurring-order reads and writes ----

const DEFAULT_CTX: MapContext = { locale: 'en-US', currency: 'USD' };
const BUSY_RETRY_MS = 1000;
const LIST_LIMIT = 50;

/** Escapes a value placed inside a double-quoted query predicate string. */
const quote = (value: string): string => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

function errorCodeOf(err: unknown): string | undefined {
  const body = (err as { body?: { errors?: { code?: unknown }[] } } | null)?.body;
  const code = body?.errors?.[0]?.code;
  return typeof code === 'string' ? code : undefined;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function listRecurringOrders(where: string, label: string): Promise<RecurringOrder[]> {
  const { body } = await withTimeout(
    getApiRoot()
      .recurringOrders()
      .get({ queryArgs: { where, expand: ['cart'], sort: ['createdAt desc'], limit: LIST_LIMIT } })
      .execute(),
    label,
  );
  return body.results;
}

/** Recurring orders of a customer, newest first, with the recurring cart expanded (the mapper needs its lines and total). */
export async function getRecurringOrdersForCustomer(customerId: string, ctx: MapContext): Promise<RecurringOrderSummary[]> {
  const list = await listRecurringOrders(`customer(id="${quote(customerId)}")`, 'recurring.byCustomer');
  return list.map((ro) => mapRecurringOrder(ro, ctx));
}

export async function getRecurringOrdersForOrder(orderId: string, ctx: MapContext): Promise<RecurringOrderSummary[]> {
  const list = await listRecurringOrders(`originOrder(id="${quote(orderId)}")`, 'recurring.byOrder');
  return list.map((ro) => mapRecurringOrder(ro, ctx));
}

/**
 * `paused`, `canceled` (with an optional reason) or `active`. A version conflict is retried once with the fresh version; an
 * `InvalidOperation` (the recurring order is processing an Order) is retried once after one second, then RECURRING_ORDER_BUSY.
 */
export async function setRecurringOrderState(id: string, state: 'paused' | 'canceled' | 'active', reason?: string, ctx: MapContext = DEFAULT_CTX): Promise<RecurringOrderSummary> {
  const action: RecurringOrderUpdateAction = {
    action: 'setRecurringOrderState',
    recurringOrderState: state === 'canceled' ? { type: 'canceled', ...(reason ? { reason } : {}) } : { type: state },
  };
  const attempt = async (): Promise<RecurringOrder> => {
    const current = await withTimeout(getApiRoot().recurringOrders().withId({ ID: id }).get().execute(), 'recurring.get');
    const { body } = await withTimeout(
      getApiRoot()
        .recurringOrders()
        .withId({ ID: id })
        .post({ queryArgs: { expand: ['cart'] }, body: { version: current.body.version, actions: [action] } })
        .execute(),
      'recurring.setState',
    );
    return body;
  };
  let conflictRetried = false;
  let busyRetried = false;
  for (;;) {
    try {
      return mapRecurringOrder(await attempt(), ctx);
    } catch (err) {
      const status = statusOf(err);
      if (status === 409 && !conflictRetried) {
        conflictRetried = true;
        continue;
      }
      if (status === 400 && errorCodeOf(err) === 'InvalidOperation') {
        if (!busyRetried) {
          busyRetried = true;
          await sleep(BUSY_RETRY_MS);
          continue;
        }
        throw new ApiError('CONFLICT', 'The recurring order is busy, retry later', { reason: RECURRING_REASON.ORDER_BUSY });
      }
      throw err;
    }
  }
}

/** Cancels every Active, Paused or Failed recurring order of the order; returns the latest `lastOrderAt` of all of them. */
export async function cancelRecurringOrdersForOrder(orderId: string, reason: string): Promise<{ canceledIds: string[]; lastOrderAt?: string }> {
  const list = await getRecurringOrdersForOrder(orderId, DEFAULT_CTX);
  const canceledIds: string[] = [];
  for (const ro of list) {
    if (ro.state === 'Active' || ro.state === 'Paused' || ro.state === 'Failed') {
      await setRecurringOrderState(ro.id, 'canceled', reason);
      canceledIds.push(ro.id);
    }
  }
  const lastOrderAt = list.map((ro) => ro.lastOrderAt).filter((v): v is string => Boolean(v)).sort().pop();
  return { canceledIds, ...(lastOrderAt ? { lastOrderAt } : {}) };
}

/** `recurringPaymentConfiguration` is not in the SDK types yet. */
function strategyOf(cart: unknown): string | undefined {
  const config = (cart as { recurringPaymentConfiguration?: { paymentStrategy?: unknown } } | undefined)?.recurringPaymentConfiguration;
  return typeof config?.paymentStrategy === 'string' ? config.paymentStrategy : undefined;
}

/**
 * Idempotent: sets `paymentStrategy: Checkout` on every recurring cart of the order that does not have it. The action shape is the one the
 * spike proved live (`setRecurringPaymentStrategy`). Under architecture A the strategy is inherited and nothing is sent.
 */
export async function ensureRecurringPaymentStrategy(orderId: string): Promise<{ checked: number; updated: number }> {
  const list = await listRecurringOrders(`originOrder(id="${quote(orderId)}")`, 'recurring.ensureStrategy');
  let updated = 0;
  for (const ro of list) {
    const cart = ro.cart.obj;
    if (!cart || strategyOf(cart) === 'Checkout') continue;
    const action = { action: 'setRecurringPaymentStrategy', paymentStrategy: 'Checkout' } as unknown as CartUpdateAction;
    await withTimeout(getApiRoot().carts().withId({ ID: cart.id }).post({ body: { version: cart.version, actions: [action] } }).execute(), 'recurring.setStrategy');
    updated += 1;
  }
  return { checked: list.length, updated };
}

/** Writes values into the order's custom fields: `setCustomType malva-order` when the order has none, else one `setCustomField` per field. */
export async function stampOrderCustomFields(orderId: string, fields: Record<string, string | number | boolean>): Promise<void> {
  const attempt = async (): Promise<void> => {
    const { body: order } = await withTimeout(getApiRoot().orders().withId({ ID: orderId }).get().execute(), 'recurring.order');
    const actions: OrderUpdateAction[] = order.custom
      ? Object.entries(fields).map(([name, value]) => ({ action: 'setCustomField', name, value }))
      : [{ action: 'setCustomType', type: { typeId: 'type', key: 'malva-order' }, fields }];
    await withTimeout(getApiRoot().orders().withId({ ID: orderId }).post({ body: { version: order.version, actions } }).execute(), 'recurring.stamp');
  };
  try {
    await attempt();
  } catch (err) {
    if (statusOf(err) !== 409) throw err;
    await attempt();
  }
}

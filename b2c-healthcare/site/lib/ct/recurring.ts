import 'server-only';
import type { Cart, RecurringOrder, RecurringOrderUpdateAction } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { loadAccountFixtures } from '@/lib/ct/fixtures';
import { POLICY_KEY, type Cadence } from '@/lib/refill-types';

/**
 * Auto-refill on commercetools Recurring Orders. Every read and write is scoped by the customer
 * id: a recurring order that belongs to somebody else is the same `null` as one that does not exist.
 *
 *  - create: a recurring Cart (customer, address, medicines with `recurrenceInfo` = policy + `Dynamic` price
 *    selection) and `POST /recurring-orders` from it; the saved payment method is attached to the recurring Cart as a
 *    100% `Checkout` payment allocation, so a refill exists only if its payment succeeded;
 *  - change: pause, resume, skip next (a `Counter` skip configuration), change the schedule in place
 *    (`setSchedule`: applies from the next generated order), cancel.
 *
 * The platform generates the orders on schedule; the storefront cannot intercept a run (no API Extension). The
 * scheduled function `auto-refill-run` checks the prescription ahead of each run and pauses, skips or stops it.
 * Health-data rule: RX numbers and medication names are never logged.
 */

/** The recurring order is being processed (an order is being created); the change can be retried in a moment. */
export class RecurringBusyError extends Error {
  constructor() {
    super('recurring order is busy');
    this.name = 'RecurringBusyError';
  }
}

async function root(): Promise<typeof apiRoot> {
  const fixtures = await loadAccountFixtures();
  return fixtures ? (fixtures.fakeRecurringRoot as unknown as typeof apiRoot) : apiRoot;
}

const statusOf = (e: unknown): number | undefined => (e as { statusCode?: number } | null)?.statusCode;
const codeOf = (e: unknown): string | undefined => (e as { body?: { errors?: { code?: string }[] } } | null)?.body?.errors?.[0]?.code;

const EXPAND = ['cart'];

/** Adds the cadence to a date (UTC; the day is kept, or the last day of a shorter month). */
export function addCadence(from: Date, cadence: Cadence): Date {
  const months = cadence === 'quarterly' ? 3 : 1;
  const d = new Date(from.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

/** The customer's own recurring orders (any state), newest first, with the recurring Cart expanded. */
export async function listRecurring(customerId: string): Promise<RecurringOrder[]> {
  const api = await root();
  const { body } = await api.recurringOrders().get({ queryArgs: { where: 'customer(id=:id)', 'var.id': customerId, expand: EXPAND, sort: 'createdAt desc', limit: 100 } }).execute();
  return body.results;
}

export async function getOwnRecurring(id: string, customerId: string): Promise<RecurringOrder | null> {
  if (!/^[\w-]{1,64}$/.test(id)) return null;
  const api = await root();
  try {
    const { body } = await api.recurringOrders().withId({ ID: id }).get({ queryArgs: { expand: EXPAND } }).execute();
    return body.customer?.id === customerId ? body : null;
  } catch (error) {
    if (statusOf(error) === 404) return null;
    throw error;
  }
}

/** Every Active recurring order (pages of 100), for the scheduled check. */
export async function listActiveRecurring(): Promise<RecurringOrder[]> {
  const api = await root();
  const out: RecurringOrder[] = [];
  for (let offset = 0; ; offset += 100) {
    const { body } = await api.recurringOrders().get({ queryArgs: { where: 'recurringOrderState="Active"', expand: EXPAND, limit: 100, offset, sort: 'createdAt asc' } }).execute();
    out.push(...body.results);
    if (body.results.length < 100) return out;
  }
}

export interface RecurringLine {
  sku: string;
  rxNumber: string;
  rxLineRef: string;
  prescribedQty: number;
}

export interface CreateRecurringInput {
  customerId: string;
  currency: string;
  country: string;
  shippingAddress?: Record<string, unknown>;
  shippingMethodKey: string;
  lines: RecurringLine[];
  cadence: Cadence;
  /** The first refill: one cadence after the order that is being repeated. */
  startsAt: Date;
  /** The saved payment method charged for every refill (needs the Checkout connector); omitted = the refill is created without payment. */
  paymentMethodId?: string;
}

const RX_LINE_TYPE_KEY = 'mlv-rx-line';

async function updateRecurring(id: string, build: (ro: RecurringOrder) => RecurringOrderUpdateAction[]): Promise<RecurringOrder> {
  const api = await root();
  for (let attempt = 0; ; attempt += 1) {
    const { body: current } = await api.recurringOrders().withId({ ID: id }).get({ queryArgs: { expand: EXPAND } }).execute();
    try {
      const { body } = await api.recurringOrders().withId({ ID: id }).post({ body: { version: current.version, actions: build(current) }, queryArgs: { expand: EXPAND } }).execute();
      return body;
    } catch (error) {
      if (statusOf(error) === 409 && attempt < 1) continue;
      if (codeOf(error) === 'InvalidOperation') throw new RecurringBusyError();
      throw error;
    }
  }
}

/**
 * Creates the recurring Cart and the Recurring Order. When the payment configuration cannot be attached, the new
 * Recurring Order is canceled again (a refill with no way to pay must not exist) and the error propagates.
 */
export async function createRecurringFromLines(input: CreateRecurringInput): Promise<RecurringOrder> {
  const api = await root();
  const policy = { typeId: 'recurrence-policy' as const, key: POLICY_KEY[input.cadence] };
  const { body: cart } = await api
    .carts()
    .post({
      body: {
        currency: input.currency,
        country: input.country,
        customerId: input.customerId,
        shippingMode: 'Single',
        taxMode: 'Platform',
        ...(input.shippingAddress ? { shippingAddress: input.shippingAddress as never } : { shippingAddress: { country: input.country } }),
        shippingMethod: { typeId: 'shipping-method', key: input.shippingMethodKey },
        lineItems: input.lines.map((l) => ({
          sku: l.sku,
          quantity: 1,
          recurrenceInfo: { recurrencePolicy: policy, priceSelectionMode: 'Dynamic' },
          custom: { type: { typeId: 'type', key: RX_LINE_TYPE_KEY }, fields: { rxNumber: l.rxNumber, rxLineRef: l.rxLineRef, prescribedQty: l.prescribedQty } },
        })),
      },
    })
    .execute();
  const { body: ro } = await api
    .recurringOrders()
    .post({ body: { key: `mlv-ro-${crypto.randomUUID()}`, cart: { typeId: 'cart', id: cart.id }, cartVersion: cart.version, startsAt: input.startsAt.toISOString() }, queryArgs: { expand: EXPAND } })
    .execute();
  if (!input.paymentMethodId) return ro;
  try {
    await attachPaymentMethod(ro, input.paymentMethodId);
  } catch (error) {
    await updateRecurring(ro.id, () => [{ action: 'setRecurringOrderState', recurringOrderState: { type: 'canceled', reason: 'payment-method-not-attached' } }]).catch(() => undefined);
    throw error;
  }
  return ro;
}

/** The payment method charged on every refill: one allocation of 100% on the recurring Cart (strategy `Checkout`, beta). */
export async function attachPaymentMethod(ro: RecurringOrder, paymentMethodId: string): Promise<void> {
  const api = await root();
  const { body: cart } = await api.carts().withId({ ID: ro.cart.id }).get().execute();
  await api
    .carts()
    .withId({ ID: cart.id })
    .post({
      body: {
        version: cart.version,
        actions: [
          {
            action: 'setRecurringPaymentConfiguration',
            paymentStrategy: 'Checkout',
            paymentAllocations: [{ paymentMethod: { typeId: 'payment-method', id: paymentMethodId }, allocation: { type: 'Relative', percentage: 100 } }],
          },
        ] as never,
      },
    })
    .execute();
}

/** The id of the payment method a recurring Cart charges, from its payment configuration; null when none. */
export function paymentMethodOf(cart: Cart | null): string | null {
  const config = (cart as unknown as { recurringPaymentConfiguration?: { paymentAllocations?: { paymentMethod?: { id?: string } }[] } } | null)?.recurringPaymentConfiguration;
  return config?.paymentAllocations?.[0]?.paymentMethod?.id ?? null;
}

/** Stops further orders until resumed. */
export const pauseRecurring = (id: string) => updateRecurring(id, () => [{ action: 'setRecurringOrderState', recurringOrderState: { type: 'paused' } }]);

/** Makes a paused recurring order active again; the next order follows the schedule from now. */
export const resumeRecurring = (id: string) => updateRecurring(id, () => [{ action: 'setRecurringOrderState', recurringOrderState: { type: 'active' } }]);

/** Ends it for good (no further orders). */
export const cancelRecurring = (id: string, reason = 'customer') => updateRecurring(id, () => [{ action: 'setRecurringOrderState', recurringOrderState: { type: 'canceled', reason } }]);

/** Skips the next generated order and only that one: `totalToSkip` is the skips already used plus one. */
export const skipNextRecurring = (id: string) =>
  updateRecurring(id, (ro) => {
    const used = ro.skipConfiguration?.type === 'Counter' ? ro.skipConfiguration.skipped : 0;
    return [{ action: 'setOrderSkipConfiguration', skipConfigurationInputDraft: { type: 'Counter', totalToSkip: used + 1 } }];
  });

/** Changes the cadence in place (same Recurring Order, same cart): applies from the next generated order. */
export const changeScheduleRecurring = (id: string, cadence: Cadence) => updateRecurring(id, () => [{ action: 'setSchedule', recurrencePolicy: { typeId: 'recurrence-policy', key: POLICY_KEY[cadence] } }]);

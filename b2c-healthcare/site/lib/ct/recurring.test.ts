// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const flags = vi.hoisted(() => ({ failConfig: false, busyOnce: false }));
vi.mock('@/lib/ct/client', async () => {
  const { fakeRecurringRoot } = await import('@/lib/ct/account-fixtures');
  const root = {
    carts: () => {
      const base = fakeRecurringRoot.carts();
      return {
        post: base.post,
        withId: (id: { ID: string }) => ({
          get: base.withId(id).get,
          post: (a: never) => {
            if (flags.failConfig) return { execute: async () => { throw Object.assign(new Error('x'), { statusCode: 400 }); } };
            return base.withId(id).post(a);
          },
        }),
      };
    },
    recurringOrders: () => {
      const base = fakeRecurringRoot.recurringOrders();
      return {
        get: base.get,
        post: base.post,
        withId: (id: { ID: string }) => ({
          get: base.withId(id).get,
          post: (a: never) => {
            if (flags.busyOnce) {
              flags.busyOnce = false;
              return { execute: async () => { throw Object.assign(new Error('busy'), { statusCode: 400, body: { errors: [{ code: 'InvalidOperation' }] } }); } };
            }
            return base.withId(id).post(a);
          },
        }),
      };
    },
  };
  return { apiRoot: root };
});

import { resetAccountFixtures } from '@/lib/ct/account-fixtures';
import {
  addCadence,
  attachPaymentMethod,
  cancelRecurring,
  changeScheduleRecurring,
  createRecurringFromLines,
  getOwnRecurring,
  listActiveRecurring,
  listRecurring,
  paymentMethodOf,
  pauseRecurring,
  RecurringBusyError,
  resumeRecurring,
  skipNextRecurring,
} from '@/lib/ct/recurring';
import { expandedCart, mapRefill } from '@/lib/mappers/recurring';

const START = new Date('2026-11-08T10:00:00Z');
const create = (over: Partial<Parameters<typeof createRecurringFromLines>[0]> = {}) =>
  createRecurringFromLines({
    customerId: 'c1',
    currency: 'USD',
    country: 'US',
    shippingMethodKey: 'mlv-standard',
    lines: [{ sku: 'MED-a', rxNumber: 'RX-77102', rxLineRef: 'RX-77102-1', prescribedQty: 30 }],
    cadence: 'monthly',
    startsAt: START,
    paymentMethodId: 'pm-1',
    ...over,
  });

beforeEach(() => {
  resetAccountFixtures();
  flags.failConfig = false;
  flags.busyOnce = false;
});

describe('subscriptions-and-recurring-orders › Recurring order created', () => {
  it('a recurring order exists with that schedule, Dynamic price selection and the next order date the buyer can see', async () => {
    const ro = await create();
    expect(ro).toMatchObject({ recurringOrderState: 'Active', schedule: { type: 'standard', intervalUnit: 'Months', value: 1 } });
    const cart = expandedCart(ro);
    expect(cart?.lineItems[0]?.recurrenceInfo).toEqual({ recurrencePolicy: { typeId: 'recurrence-policy', key: 'mlv-monthly' }, priceSelectionMode: 'Dynamic' });
    const view = mapRefill(ro, 'en-US');
    expect(view).toMatchObject({ state: 'Active', cadence: 'monthly', nextOrderAt: START.toISOString(), priceMode: 'Dynamic', skipping: false });
    expect(view.lines).toHaveLength(1);
    expect(JSON.stringify(view)).not.toContain('RX-77102');
  });

  it('the prescription reference rides on the recurring line (for the gate), the payment method as a 100% Checkout allocation', async () => {
    const ro = await create({ cadence: 'quarterly' });
    expect(ro.schedule).toMatchObject({ value: 3 });
    const { fakeRecurringRoot } = await import('@/lib/ct/account-fixtures');
    const { body: cart } = await fakeRecurringRoot.carts().withId({ ID: ro.cart.id }).get().execute();
    expect((cart as never as { lineItems: { custom: { fields: Record<string, unknown> } }[] }).lineItems[0]?.custom.fields).toEqual({ rxNumber: 'RX-77102', rxLineRef: 'RX-77102-1', prescribedQty: 30 });
    expect(cart).toMatchObject({ origin: 'RecurringOrder', recurringPaymentConfiguration: { paymentStrategy: 'Checkout', paymentAllocations: [{ paymentMethod: { typeId: 'payment-method', id: 'pm-1' }, allocation: { type: 'Relative', percentage: 100 } }] } });
    expect(paymentMethodOf(cart as never)).toBe('pm-1');
  });

  it('when the payment method cannot be attached the new recurring order is canceled again (no refill without a way to pay)', async () => {
    flags.failConfig = true;
    await expect(create()).rejects.toMatchObject({ statusCode: 400 });
    expect((await listRecurring('c1')).map((r) => r.recurringOrderState)).toEqual(['Canceled']);
  });

  it('lists only the own recurring orders; a foreign id is the same null as an unknown one', async () => {
    const mine = await create();
    await create({ customerId: 'c2' });
    expect((await listRecurring('c1')).map((r) => r.id)).toEqual([mine.id]);
    expect(await getOwnRecurring(mine.id, 'c2')).toBeNull();
    expect(await getOwnRecurring('nope', 'c1')).toBeNull();
    expect(await getOwnRecurring('../x', 'c1')).toBeNull();
    expect((await getOwnRecurring(mine.id, 'c1'))?.id).toBe(mine.id);
  });

  it('the cadence is one month or three after a date, keeping the day or the last day of a shorter month', () => {
    expect(addCadence(new Date('2026-10-08T10:00:00Z'), 'monthly').toISOString()).toBe('2026-11-08T10:00:00.000Z');
    expect(addCadence(new Date('2026-10-08T10:00:00Z'), 'quarterly').toISOString()).toBe('2027-01-08T10:00:00.000Z');
    expect(addCadence(new Date('2026-01-31T10:00:00Z'), 'monthly').toISOString()).toBe('2026-02-28T10:00:00.000Z');
  });
});

describe('subscriptions-and-recurring-orders › Schedule changed in place', () => {
  it('the cadence changes on the SAME recurring order and cart; nothing is recreated', async () => {
    const ro = await create();
    const changed = await changeScheduleRecurring(ro.id, 'quarterly');
    expect(changed.id).toBe(ro.id);
    expect(changed.cart.id).toBe(ro.cart.id);
    expect(changed.schedule).toMatchObject({ intervalUnit: 'Months', value: 3 });
    expect(mapRefill(changed, 'en-US').cadence).toBe('quarterly');
    expect((await listRecurring('c1')).length).toBe(1);
  });

  it('a change while an order is being created is a typed "busy" error, retryable', async () => {
    const ro = await create();
    flags.busyOnce = true;
    await expect(pauseRecurring(ro.id)).rejects.toBeInstanceOf(RecurringBusyError);
    expect((await pauseRecurring(ro.id)).recurringOrderState).toBe('Paused');
  });
});

describe('subscriptions-and-recurring-orders › Catalog price moved', () => {
  it('the configured price selection decides and the page can say which: Dynamic is set on every recurring line', async () => {
    const ro = await create({ lines: [
      { sku: 'MED-a', rxNumber: 'RX-1', rxLineRef: 'a', prescribedQty: 30 },
      { sku: 'MED-b', rxNumber: 'RX-1', rxLineRef: 'b', prescribedQty: 30 },
    ] });
    const modes = expandedCart(ro)?.lineItems.map((l) => l.recurrenceInfo?.priceSelectionMode);
    expect(modes).toEqual(['Dynamic', 'Dynamic']);
    expect(mapRefill(ro, 'en-US').priceMode).toBe('Dynamic');
    const fixed = structuredClone(ro);
    (expandedCart(fixed)!.lineItems[0] as { recurrenceInfo?: unknown }).recurrenceInfo = { priceSelectionMode: 'Fixed' };
    expect(mapRefill(fixed, 'en-US').priceMode).toBe('Fixed');
  });
});

describe('subscriptions-and-recurring-orders › Paused or canceled', () => {
  it('pausing stops the next order (no next date); resuming makes it active again', async () => {
    const ro = await create();
    const paused = await pauseRecurring(ro.id);
    expect(mapRefill(paused, 'en-US')).toMatchObject({ state: 'Paused', nextOrderAt: null });
    expect((await listActiveRecurring()).map((r) => r.id)).not.toContain(ro.id);
    const resumed = await resumeRecurring(ro.id);
    expect(mapRefill(resumed, 'en-US').state).toBe('Active');
    expect((await listActiveRecurring()).map((r) => r.id)).toContain(ro.id);
  });

  it('canceling ends it: no next date, no longer active, and the buyer sees when the last order was', async () => {
    const ro = await create();
    const canceled = await cancelRecurring(ro.id);
    const withLast = { ...canceled, lastOrderAt: '2026-10-08T10:00:00Z' };
    expect(mapRefill(withLast as never, 'en-US')).toMatchObject({ state: 'Canceled', nextOrderAt: null, lastOrderAt: '2026-10-08T10:00:00Z' });
    expect(await listActiveRecurring()).toEqual([]);
  });

  it('skip next sets a counter of one more skip than already used, and the view says it is skipping', async () => {
    const ro = await create();
    const skipped = await skipNextRecurring(ro.id);
    expect(skipped.skipConfiguration).toMatchObject({ type: 'Counter', totalToSkip: 1 });
    expect(mapRefill(skipped, 'en-US').skipping).toBe(true);
    expect(mapRefill(ro, 'en-US').skipping).toBe(false);
  });

  it('attaching a different payment method replaces the allocation', async () => {
    const ro = await create();
    await attachPaymentMethod(ro, 'pm-2');
    const { fakeRecurringRoot } = await import('@/lib/ct/account-fixtures');
    const { body: cart } = await fakeRecurringRoot.carts().withId({ ID: ro.cart.id }).get().execute();
    expect(paymentMethodOf(cart as never)).toBe('pm-2');
  });
});

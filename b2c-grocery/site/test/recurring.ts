import type { RecurringOrder } from '@commercetools/platform-sdk';
import cartFixture from '@/lib/mappers/__fixtures__/cart.json';
import type { RecurringOrderSummary } from '@/lib/types';

export type Json = Record<string, unknown>;

/** The recurring cart: the recurring (milk) line of the shared cart fixture, policy `weekly` expanded with names. */
export const recurringCart = (): Json => {
  const lines = (cartFixture as unknown as { lineItems: Json[] }).lineItems.filter((l) => l.recurrenceInfo);
  const withPolicy = lines.map((l) => ({
    ...l,
    recurrenceInfo: {
      ...(l.recurrenceInfo as Json),
      recurrencePolicy: { typeId: 'recurrence-policy', id: 'rp-1', obj: { key: 'weekly', name: { 'en-US': 'Every week', 'de-DE': 'Jede Woche' } } },
    },
  }));
  return { ...(cartFixture as unknown as Json), id: 'rc-1', version: 7, origin: 'RecurringOrder', lineItems: withPolicy };
};

/** An SDK Recurring Order with `cart` and `originOrder` expanded (as `lib/ct/recurring-orders.ts` reads it). */
export const recurringOrder = (over: Json = {}): RecurringOrder =>
  ({
    id: 'ro-1',
    version: 3,
    cart: { typeId: 'cart', id: 'rc-1', obj: recurringCart() },
    originOrder: { typeId: 'order', id: 'o-1', obj: { id: 'o-1', createdAt: '2026-10-06T22:20:26.000Z' } },
    startsAt: '2026-10-06T22:20:26.306Z',
    nextOrderAt: '2026-10-13T22:20:26.306Z',
    recurringOrderState: 'Active',
    schedule: { type: 'standard', value: 1, intervalUnit: 'Weeks' },
    customer: { typeId: 'customer', id: 'cu-1' },
    ...over,
  }) as unknown as RecurringOrder;

/** An app-side summary for component and hook tests. */
export const summary = (over: Partial<RecurringOrderSummary> = {}): RecurringOrderSummary => ({
  id: 'ro-1',
  state: 'Active',
  stateRaw: 'Active',
  cadenceLabel: 'Every 2 weeks',
  policyKey: 'every-2-weeks',
  lines: [{ id: 'l-1', sku: 'MILK-1L', name: 'Whole milk 1 L', quantity: 2 }],
  nextOrderAt: '2026-10-20T10:00:00.000Z',
  lastOrderAt: '2026-10-06T10:00:00.000Z',
  ...over,
});

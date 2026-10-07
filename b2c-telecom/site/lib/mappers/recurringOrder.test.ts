import type { RecurringOrder } from '@commercetools/platform-sdk';
import { mapRecurringOrder } from './recurringOrder';

const ctx = { locale: 'de-DE', currency: 'EUR' } as const;

function ro(over: Record<string, unknown> = {}): RecurringOrder {
  return {
    id: 'ro-1',
    key: 'k-1',
    version: 1,
    cart: {
      typeId: 'cart',
      id: 'c-1',
      obj: {
        totalPrice: { centAmount: 9000, currencyCode: 'USD' },
        lineItems: [
          { name: { 'en-US': 'Cable 500', 'de-DE': 'Kabel 500' }, variant: { sku: 'MLV-CBL-500-24M' }, quantity: 1, recurrenceInfo: { priceSelectionMode: 'Fixed' } },
          { name: { 'en-US': 'Spotify' }, variant: { sku: 'MLV-ADD-SPOTIFY-MTH' }, quantity: 2, recurrenceInfo: { priceSelectionMode: 'Dynamic' } },
          { name: { 'en-US': 'No info' }, variant: { sku: 'X' }, quantity: 1 },
        ],
      },
    },
    originOrder: { typeId: 'order', id: 'o-1' },
    startsAt: '2026-10-07T10:00:00.000Z',
    nextOrderAt: '2026-11-07T10:00:00.000Z',
    recurringOrderState: 'Active',
    schedule: { type: 'standard', value: 1, intervalUnit: 'Months' },
    ...over,
  } as unknown as RecurringOrder;
}

describe('mapRecurringOrder', () => {
  it('Recurring order created: summary exposes cadence, state and the next order date', () => {
    const summary = mapRecurringOrder(ro(), ctx);
    expect(summary).toMatchObject({
      id: 'ro-1',
      key: 'k-1',
      originOrderId: 'o-1',
      state: 'Active',
      startsAt: '2026-10-07T10:00:00.000Z',
      nextOrderAt: '2026-11-07T10:00:00.000Z',
      cadence: { unit: 'Months', every: 1 },
      monthly: { centAmount: 9000, currencyCode: 'USD' },
    });
    expect(summary.lastOrderAt).toBeUndefined();
  });

  it('maps a day-of-month schedule', () => {
    expect(mapRecurringOrder(ro({ schedule: { type: 'dayOfMonth', day: 15 } }), ctx).cadence).toEqual({ dayOfMonth: 15 });
  });

  it('Catalog price moved: each line carries its price selection mode', () => {
    const { lines } = mapRecurringOrder(ro(), ctx);
    expect(lines).toEqual([
      { name: 'Kabel 500', sku: 'MLV-CBL-500-24M', quantity: 1, priceSelectionMode: 'Fixed' },
      { name: 'Spotify', sku: 'MLV-ADD-SPOTIFY-MTH', quantity: 2, priceSelectionMode: 'Dynamic' },
      { name: 'No info', sku: 'X', quantity: 1, priceSelectionMode: null },
    ]);
  });

  it('a Failed recurring order carries its failure reason', () => {
    const summary = mapRecurringOrder(ro({ recurringOrderState: 'Failed', failure: { message: 'Card declined' } }), ctx);
    expect(summary.state).toBe('Failed');
    expect(summary.failureReason).toBe('Card declined');
  });

  it('a missing expanded cart gives a zero total in the market currency and no lines', () => {
    const summary = mapRecurringOrder(ro({ cart: { typeId: 'cart', id: 'c-1' } }), ctx);
    expect(summary.monthly).toEqual({ centAmount: 0, currencyCode: 'EUR' });
    expect(summary.lines).toEqual([]);
  });
});

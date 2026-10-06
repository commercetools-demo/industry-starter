import { describe, it, expect } from 'vitest';
import { recurringCart, recurringOrder, type Json } from '@/test/recurring';
import { mapRecurringOrder, mapRecurringState } from './recurring-order';

describe('mapRecurringOrder', () => {
  it('Active recurring order: items, localized cadence, state and next order date', () => {
    const s = mapRecurringOrder(recurringOrder(), { locale: 'en-US' });
    expect(s).toMatchObject({
      id: 'ro-1',
      state: 'Active',
      stateRaw: 'Active',
      cadenceLabel: 'Every week',
      policyKey: 'weekly',
      nextOrderAt: '2026-10-13T22:20:26.306Z',
    });
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]).toMatchObject({ id: expect.any(String), sku: expect.any(String), name: expect.any(String), quantity: 3 });
    expect(mapRecurringOrder(recurringOrder(), { locale: 'de-DE' }).cadenceLabel).toBe('Jede Woche');
  });

  it('last order date: the first order until a scheduled one exists, then lastOrderAt', () => {
    expect(mapRecurringOrder(recurringOrder(), { locale: 'en-US' }).lastOrderAt).toBe('2026-10-06T22:20:26.000Z');
    expect(mapRecurringOrder(recurringOrder({ lastOrderAt: '2026-10-13T22:21:00.000Z' }), { locale: 'en-US' }).lastOrderAt).toBe('2026-10-13T22:21:00.000Z');
  });

  it('paused: no next order date', () => {
    const s = mapRecurringOrder(recurringOrder({ recurringOrderState: 'Paused', nextOrderAt: undefined }), { locale: 'en-US' });
    expect(s.state).toBe('Paused');
    expect(s).not.toHaveProperty('nextOrderAt');
  });

  it('without expanded policy name falls back to the schedule', () => {
    const cart = recurringCart();
    delete (((cart.lineItems as Json[])[0] as Json).recurrenceInfo as { recurrencePolicy: Json }).recurrencePolicy.obj;
    const s = mapRecurringOrder(recurringOrder({ cart: { typeId: 'cart', id: 'rc-1', obj: cart }, schedule: { type: 'standard', value: 2, intervalUnit: 'Weeks' } }), { locale: 'en-US' });
    expect(s.cadenceLabel).toBe('2 Weeks');
    expect(s).not.toHaveProperty('policyKey');
  });

  it('state mapping: Expired and Failed are Other', () => {
    expect(['Active', 'Paused', 'Canceled', 'Expired', 'Failed'].map(mapRecurringState)).toEqual(['Active', 'Paused', 'Canceled', 'Other', 'Other']);
  });
});

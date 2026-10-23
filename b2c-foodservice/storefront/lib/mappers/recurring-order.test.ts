import { describe, expect, it } from 'vitest';
import { mapRecurringOrder, pendingFrom } from '@/lib/mappers/recurring-order';
import { POLICY_1M, POLICY_2W, ctCart, ctOriginOrder, ctRecurringOrder, recurringLine } from '@/test/recurring';

describe('mapRecurringOrder', () => {
  it('lines come from the recurring cart', () => {
    const raw = ctRecurringOrder({ cart: { typeId: 'cart', id: 'rc', obj: ctCart([recurringLine('a'), recurringLine('b')]) } });
    const sub = mapRecurringOrder(raw, 'en-US');
    expect(sub.lines.map((l) => l.lineId)).toEqual(['a', 'b']);
    expect(sub.lines[0]).toMatchObject({ variantLabel: '50 capsules', quantity: 2, unitPrice: { centAmount: 2205, currencyCode: 'USD' }, totalPrice: { centAmount: 4410 } });
    expect(sub.total.centAmount).toBe(8820);
    expect(sub.policyId).toBe(POLICY_1M);
    expect(sub.priceSelectionMode).toBe('fixed');
  });

  it('lines fall back to the origin order filtered by policy', () => {
    const month = recurringLine('m', POLICY_1M, {
      recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy', id: POLICY_1M, obj: { schedule: { type: 'standard', value: 1, intervalUnit: 'Months' } } }, priceSelectionMode: 'Fixed' },
    });
    const weeks = recurringLine('w', POLICY_2W, {
      recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy', id: POLICY_2W, obj: { schedule: { type: 'standard', value: 2, intervalUnit: 'Weeks' } } }, priceSelectionMode: 'Fixed' },
    });
    const oneTime = recurringLine('o', POLICY_1M, { recurrenceInfo: undefined });
    const raw = ctRecurringOrder({
      cart: { typeId: 'cart', id: 'rc' },
      originOrder: { typeId: 'order', id: 'o-1', obj: ctOriginOrder({ lineItems: [month, weeks, oneTime] }) },
    });
    expect(mapRecurringOrder(raw, 'en-US').lines.map((l) => l.lineId)).toEqual(['m']);
  });

  it('next order date is renamed at the API layer', () => {
    const sub = mapRecurringOrder(ctRecurringOrder({ lastOrderAt: '2026-11-19T08:00:00.000Z' }), 'en-US');
    expect(sub.nextOrderDate).toBe('2026-11-19T08:00:00.000Z');
    expect(sub.lastOrderDate).toBe('2026-11-19T08:00:00.000Z');
    expect(sub.startedAt).toBe('2026-10-19T08:00:00.000Z');
    expect(sub).not.toHaveProperty('nextOrderAt');
  });

  it('pending skips derive from the counter', () => {
    const skip = (totalToSkip: number, skipped: number) =>
      mapRecurringOrder(ctRecurringOrder({ skipConfiguration: { type: 'Counter', totalToSkip, skipped } }), 'en-US').pendingSkips;
    expect(skip(1, 0)).toBe(1);
    expect(skip(1, 1)).toBe(0);
    expect(skip(0, 3)).toBe(0);
    expect(mapRecurringOrder(ctRecurringOrder(), 'en-US').pendingSkips).toBe(0);
  });

  it('canceled maps to the canceled state with one l', () => {
    const states = ['Active', 'Paused', 'Canceled', 'Expired', 'Failed'].map((s) => mapRecurringOrder(ctRecurringOrder({ recurringOrderState: s }), 'en-US').state);
    expect(states).toEqual(['active', 'paused', 'canceled', 'expired', 'failed']);
  });

  it('unlabelable schedule maps to null', () => {
    const raw = ctRecurringOrder({ schedule: { type: 'dayOfMonth', day: 5 } });
    expect(mapRecurringOrder(raw, 'en-US').schedule).toBeNull();
    expect(mapRecurringOrder(ctRecurringOrder(), 'en-US').schedule).toEqual({ unit: 'Months', value: 1 });
  });

  it('a paused order has no next date', () => {
    const sub = mapRecurringOrder(ctRecurringOrder({ recurringOrderState: 'Paused', nextOrderAt: undefined }), 'en-US');
    expect(sub.nextOrderDate).toBeNull();
  });
});

describe('pendingFrom', () => {
  it('order with subscribe lines and no recurring order is pending', () => {
    const withSub = ctOriginOrder({ id: 'o-2', orderNumber: 'MC-10043' });
    const plain = ctOriginOrder({ id: 'o-3', lineItems: [recurringLine('x', POLICY_1M, { recurrenceInfo: undefined })] });
    const known = ctOriginOrder({ id: 'o-1' });
    const out = pendingFrom([withSub, plain, known], [{ originOrderId: 'o-1' }], 'en-US');
    expect(out.map((p) => p.orderId)).toEqual(['o-2']);
    expect(out[0]).toMatchObject({ orderNumber: 'MC-10043', lines: [{ quantity: 2, policyId: POLICY_1M }] });
  });
});

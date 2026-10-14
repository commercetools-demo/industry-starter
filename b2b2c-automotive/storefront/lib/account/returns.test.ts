// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { RETURN_REASONS } from '@/lib/contracts/return-item';
import { buildReturnAction, deliveredAtOf, returnEligibility, returnNumberFor, returnTrackingId, returnedQuantities, windowDaysOf, type ReturnableOrder } from './returns';

const NOW = new Date('2026-10-12T10:00:00Z');
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const order = (over: Partial<ReturnableOrder> = {}): ReturnableOrder => ({
  orderNumber: 'MA-ABCD1234',
  shipmentState: 'Delivered',
  lastModifiedAt: day(1),
  custom: { fields: { deliveredAt: day(3) } },
  lineItems: [
    { id: 'l1', name: { 'en-US': 'Brake pads' }, quantity: 4 },
    { id: 'l2', name: { 'en-US': 'Wipers' }, quantity: 2 },
  ],
  returnInfo: [],
  ...over,
});

describe('return eligibility', () => {
  it('a delivered order inside the window is eligible with the full quantities', () => {
    const r = returnEligibility(order(), { now: NOW, locale: 'en-US' });
    expect(r.eligible).toBe(true);
    expect(r.lines).toEqual([
      { lineItemId: 'l1', name: 'Brake pads', remaining: 4 },
      { lineItemId: 'l2', name: 'Wipers', remaining: 2 },
    ]);
  });
  it('not delivered is refused', () => {
    expect(returnEligibility(order({ shipmentState: 'Shipped', custom: undefined }), { now: NOW, locale: 'en-US' }).problem).toBe('not-delivered');
  });
  it('day 30 after delivery is allowed and day 31 is refused', () => {
    expect(returnEligibility(order({ custom: { fields: { deliveredAt: day(30) } } }), { now: NOW, locale: 'en-US' }).eligible).toBe(true);
    const late = returnEligibility(order({ custom: { fields: { deliveredAt: day(31) } } }), { now: NOW, locale: 'en-US' });
    expect(late.eligible).toBe(false);
    expect(late.problem).toBe('window-closed');
  });
  it('window counts from deliveredAt, with lastModifiedAt only as the fallback of a delivered order', () => {
    expect(deliveredAtOf(order())).toBe(day(3));
    expect(deliveredAtOf(order({ custom: undefined, lastModifiedAt: day(9) }))).toBe(day(9));
    expect(deliveredAtOf(order({ custom: undefined, shipmentState: 'Pending' }))).toBeNull();
  });
  it('window reads store-settings returnWindowDays with default 30', () => {
    expect(windowDaysOf(undefined)).toBe(30);
    expect(windowDaysOf(14)).toBe(14);
    expect(windowDaysOf(0)).toBe(30);
    const short = returnEligibility(order({ custom: { fields: { deliveredAt: day(20) } } }), { now: NOW, locale: 'en-US', windowDays: 14 });
    expect(short.problem).toBe('window-closed');
  });
  it('quantity above remaining: units in earlier returns reduce what is left, rejected returns do not count', () => {
    const o = order({
      returnInfo: [
        { returnTrackingId: 'RT-1', items: [{ lineItemId: 'l1', quantity: 3, custom: { fields: { status: 'requested' } } }] },
        { returnTrackingId: 'RT-2', items: [{ lineItemId: 'l2', quantity: 2, custom: { fields: { status: 'rejected' } } }] },
      ],
    });
    expect(returnedQuantities(o).get('l1')).toBe(3);
    expect(returnedQuantities(o).get('l2')).toBeUndefined();
    const r = returnEligibility(o, { now: NOW, locale: 'en-US' });
    expect(r.lines.map((l) => l.remaining)).toEqual([1, 2]);
  });
  it('second identical request for the full quantity leaves nothing', () => {
    const o = order({
      returnInfo: [{ items: [{ lineItemId: 'l1', quantity: 4 }, { lineItemId: 'l2', quantity: 2 }] }],
    });
    const r = returnEligibility(o, { now: NOW, locale: 'en-US' });
    expect(r.eligible).toBe(false);
    expect(r.problem).toBe('nothing-left');
  });
});

describe('return identifiers and action', () => {
  it('tracking id format RT-yyyymmdd-5 base32 characters', () => {
    expect(returnTrackingId(NOW)).toMatch(/^RT-20261012-[ABCDEFGHJKMNPQRSTVWXYZ0-9]{5}$/);
  });
  it('return number is RET-order-n with the next free n', () => {
    expect(returnNumberFor(order())).toBe('RET-MA-ABCD1234-1');
    const o = order({ returnInfo: [{ items: [{ lineItemId: 'l1', quantity: 1, custom: { fields: { returnNumber: 'RET-MA-ABCD1234-1' } } }] }] });
    expect(returnNumberFor(o)).toBe('RET-MA-ABCD1234-2');
  });
  it('addReturnInfo uses type malva-return-item with returnNumber, status requested and reason', () => {
    const action = buildReturnAction(order(), { items: [{ lineItemId: 'l1', quantity: 2 }], reason: 'wrong-fit', comment: 'too small' }, NOW);
    expect(action.action).toBe('addReturnInfo');
    expect(action.returnTrackingId).toMatch(/^RT-/);
    expect(action.returnDate).toBe(NOW.toISOString());
    expect(action.items).toEqual([
      {
        lineItemId: 'l1',
        quantity: 2,
        comment: 'too small',
        shipmentState: 'Advised',
        custom: { type: { typeId: 'type', key: 'malva-return-item' }, fields: { returnNumber: 'RET-MA-ABCD1234-1', status: 'requested', reason: 'wrong-fit' } },
      },
    ]);
  });
  it('uses the portal reasons', () => {
    expect(RETURN_REASONS).toContain('wrong-fit');
  });
});

import { describe, expect, it } from 'vitest';
import { canReturn, deriveOrderStatus, pillKey, returnWindowEnds, type StatusInput } from '@/lib/account/order-status';

const base: StatusInput = { orderState: 'Open', stateKey: 'ordered', shipmentState: null, hasCollect: true, hasShip: false };
const s = (over: Partial<StatusInput>) => deriveOrderStatus({ ...base, ...over });

describe('Status table', () => {
  it('cancelled wins over everything', () => {
    expect(s({ orderState: 'Cancelled', stateKey: 'collected' })).toBe('cancelled');
  });
  it('collect only, collected is completed', () => {
    expect(s({ stateKey: 'collected' })).toBe('completed');
  });
  it('ship only, delivered is completed', () => {
    expect(s({ hasCollect: false, hasShip: true, stateKey: null, shipmentState: 'Delivered' })).toBe('completed');
  });
  it('mixed is completed only when both halves are done', () => {
    expect(s({ hasShip: true, stateKey: 'collected', shipmentState: 'Shipped' })).toBe('shipped');
    expect(s({ hasShip: true, stateKey: 'collected', shipmentState: 'Delivered' })).toBe('completed');
  });
  it('ready for collection is ready', () => {
    expect(s({ stateKey: 'ready-for-collection' })).toBe('ready');
  });
  it('ship line shipped or partly shipped is shipped', () => {
    expect(s({ hasCollect: false, hasShip: true, stateKey: null, shipmentState: 'Shipped' })).toBe('shipped');
    expect(s({ hasCollect: false, hasShip: true, stateKey: null, shipmentState: 'Partial' })).toBe('shipped');
  });
  it('preparing collect order is preparing', () => {
    expect(s({ stateKey: 'preparing' })).toBe('preparing');
  });
  it('new orders, with or without a state, are ordered', () => {
    expect(s({})).toBe('ordered');
    expect(s({ stateKey: null })).toBe('ordered');
    expect(s({ hasCollect: false, hasShip: true, stateKey: null, shipmentState: 'Pending' })).toBe('ordered');
  });
  it('Mixed order status prefers ready over shipped', () => {
    expect(s({ hasShip: true, stateKey: 'ready-for-collection', shipmentState: 'Shipped' })).toBe('ready');
  });
  it('pill label follows the kind of order', () => {
    expect(pillKey('completed', true, false)).toBe('collected');
    expect(pillKey('completed', false, true)).toBe('delivered');
    expect(pillKey('completed', true, true)).toBe('completed');
    expect(pillKey('ready', true, true)).toBe('ready');
  });
});

describe('canReturn', () => {
  const doneAt = '2026-10-01T00:00:00.000Z';
  const ok = { status: 'completed' as const, completedAt: doneAt, returnable: { l1: 2 } };
  it('is allowed inside the window', () => {
    expect(canReturn(ok, new Date('2026-10-20T00:00:00.000Z'), 30)).toBe(true);
  });
  it('Return window closed is refused', () => {
    expect(canReturn(ok, new Date('2026-11-05T00:00:00.000Z'), 30)).toBe(false);
  });
  it('Order not completed is not returnable', () => {
    expect(canReturn({ ...ok, status: 'shipped' }, new Date('2026-10-02T00:00:00.000Z'), 30)).toBe(false);
  });
  it('nothing left to return is refused', () => {
    expect(canReturn({ ...ok, returnable: { l1: 0 } }, new Date('2026-10-02T00:00:00.000Z'), 30)).toBe(false);
  });
  it('window end is days after completion', () => {
    expect(returnWindowEnds(doneAt, 30).toISOString()).toBe('2026-10-31T00:00:00.000Z');
  });
});

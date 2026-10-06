import { describe, it, expect } from 'vitest';
import { parseCheckoutEvent } from './checkout-events';

describe('parseCheckoutEvent', () => {
  it('checkout_completed message (docs sample): order created with its id', () => {
    const message = { severity: 'info', code: 'checkout_completed', payload: { order: { id: 'ord-1' } }, correlationId: 'spa/x' };
    expect(parseCheckoutEvent(message)).toEqual({ type: 'order-created', orderId: 'ord-1' });
  });
  it('order_created message (docs sample): order created with its id', () => {
    const message = { severity: 'info', code: 'order_created', message: 'Order ord-2 created.', payload: { order: { id: 'ord-2' } } };
    expect(parseCheckoutEvent(message)).toEqual({ type: 'order-created', orderId: 'ord-2' });
  });
  it('other messages are ignored', () => {
    expect(parseCheckoutEvent({ code: 'payment_started' })).toEqual({ type: 'other' });
    expect(parseCheckoutEvent({ code: 'payment_failed', payload: { order: { id: 'x' } } })).toEqual({ type: 'other' });
  });
  it('malformed payloads are ignored', () => {
    const bad = [null, 'x', 5, {}, { code: 'checkout_completed' }, { code: 'checkout_completed', payload: {} }, { code: 'checkout_completed', payload: { order: { id: 7 } } }, { code: 'order_created', payload: { order: { id: '' } } }];
    for (const m of bad) expect(parseCheckoutEvent(m)).toEqual({ type: 'other' });
  });
});

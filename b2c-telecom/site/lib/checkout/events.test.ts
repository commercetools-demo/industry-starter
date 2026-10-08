import { parseCheckoutMessage } from './events';

const msg = (code: string, order?: unknown) => ({ severity: 'INFO', code, message: 'x', payload: order === undefined ? {} : { order }, correlationId: 'c' });

describe('parseCheckoutMessage', () => {
  it('maps both completion codes to order-created with the order id', () => {
    expect(parseCheckoutMessage(msg('checkout_completed', { id: 'o1' }))).toEqual({ type: 'order-created', orderId: 'o1' });
    expect(parseCheckoutMessage(msg('order_created', { id: 'o2' }))).toEqual({ type: 'order-created', orderId: 'o2' });
  });
  it('a completion without an order id is other', () => expect(parseCheckoutMessage(msg('checkout_completed'))).toEqual({ type: 'other' }));
  it('maps the failure codes', () => {
    expect(parseCheckoutMessage(msg('checkout_cancelled'))).toEqual({ type: 'cancelled' });
    expect(parseCheckoutMessage(msg('payment_failed'))).toEqual({ type: 'payment-failed' });
    expect(parseCheckoutMessage(msg('expired_session'))).toEqual({ type: 'session-expired' });
    expect(parseCheckoutMessage(msg('non_orderable_cart_error'))).toEqual({ type: 'not-orderable' });
    for (const code of ['cart_not_found', 'cart_emptied_during_checkout', 'cart_empty']) expect(parseCheckoutMessage(msg(code))).toEqual({ type: 'cart-gone' });
  });
  it('unknown and malformed messages are other', () => {
    expect(parseCheckoutMessage(msg('whatever'))).toEqual({ type: 'other' });
    expect(parseCheckoutMessage(null)).toEqual({ type: 'other' });
    expect(parseCheckoutMessage('x')).toEqual({ type: 'other' });
    expect(parseCheckoutMessage({ code: 5 })).toEqual({ type: 'other' });
  });
});

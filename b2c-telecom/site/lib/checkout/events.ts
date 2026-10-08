// What the hosted Checkout tells the page (SDK `onInfo` / `onWarn` / `onError`). Pure and client-safe.
// Message shape from the docs: { severity, code, message, payload: { order: { id } }, correlationId }.

export type CheckoutEvent =
  | { type: 'order-created'; orderId: string }
  | { type: 'cancelled' }
  | { type: 'payment-failed' }
  | { type: 'session-expired' }
  | { type: 'not-orderable' }
  | { type: 'cart-gone' }
  | { type: 'other' };

const CART_GONE = new Set(['cart_not_found', 'cart_emptied_during_checkout', 'cart_empty']);

function orderIdOf(message: object): string | null {
  const payload = (message as { payload?: unknown }).payload;
  if (typeof payload !== 'object' || payload === null) return null;
  const order = (payload as { order?: unknown }).order;
  if (typeof order !== 'object' || order === null) return null;
  const id = (order as { id?: unknown }).id;
  return typeof id === 'string' && id !== '' ? id : null;
}

export function parseCheckoutMessage(message: unknown): CheckoutEvent {
  if (typeof message !== 'object' || message === null) return { type: 'other' };
  const code = (message as { code?: unknown }).code;
  if (typeof code !== 'string') return { type: 'other' };
  if (code === 'checkout_completed' || code === 'order_created') {
    const orderId = orderIdOf(message);
    return orderId ? { type: 'order-created', orderId } : { type: 'other' };
  }
  if (code === 'checkout_cancelled') return { type: 'cancelled' };
  if (code === 'payment_failed') return { type: 'payment-failed' };
  if (code === 'expired_session') return { type: 'session-expired' };
  if (code === 'non_orderable_cart_error') return { type: 'not-orderable' };
  if (CART_GONE.has(code)) return { type: 'cart-gone' };
  return { type: 'other' };
}

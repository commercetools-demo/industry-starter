/** Client-safe: turns the Checkout Browser SDK messages (`onInfo`) into the one thing the storefront cares about. */
export type CheckoutEvent = { type: 'order-created'; orderId: string } | { type: 'other' };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Both `checkout_completed` and `order_created` carry `payload.order.id` (docs: Checkout Messages, Browser SDK
 * "Checkout completion"). Anything else, or a payload without a string order id, is `other`.
 */
export function parseCheckoutEvent(message: unknown): CheckoutEvent {
  if (!isRecord(message)) return { type: 'other' };
  if (message.code !== 'checkout_completed' && message.code !== 'order_created') return { type: 'other' };
  const order = isRecord(message.payload) ? message.payload.order : undefined;
  const id = isRecord(order) ? order.id : undefined;
  return typeof id === 'string' && id !== '' ? { type: 'order-created', orderId: id } : { type: 'other' };
}

import type { Order, Payment } from '@commercetools/platform-sdk';
import { mapMoney } from '@/lib/mappers';
import { CANCELLABLE, type OrderStatus, type OrderView, type RefundStatus, type ShipmentState } from '@/lib/order-types';

const STATE_PREFIX = 'mlv-';
const STATUSES: readonly OrderStatus[] = ['received', 'pharmacist-review', 'packed-shipped', 'delivered', 'cancelled'];
const SHIPMENT: readonly ShipmentState[] = ['Pending', 'Ready', 'Shipped', 'Delivered', 'Partial', 'Backorder', 'Delayed'];

/** The order State key as a status. An order without a (known) state is shown as received: it exists and nothing else is known. */
export function statusOfState(key: string | undefined): OrderStatus {
  const bare = key?.startsWith(STATE_PREFIX) ? key.slice(STATE_PREFIX.length) : undefined;
  return STATUSES.find((s) => s === bare) ?? 'received';
}

/** Refund state from the Payments' `Refund` transactions: Success is refunded, anything else open is requested. */
export function refundOf(payments: Pick<Payment, 'transactions'>[]): RefundStatus {
  const refunds = payments.flatMap((p) => p.transactions).filter((t) => t.type === 'Refund');
  if (refunds.some((t) => t.state === 'Success')) return 'refunded';
  if (refunds.some((t) => t.state === 'Initial' || t.state === 'Pending')) return 'requested';
  return 'none';
}

export const paymentsOf = (order: Pick<Order, 'paymentInfo'>): Payment[] =>
  (order.paymentInfo?.payments ?? []).map((ref) => ref.obj).filter((p): p is Payment => p !== undefined);

function localized(name: Record<string, string>, locale: string): string {
  return name[locale] ?? name[locale.split('-')[0] ?? ''] ?? Object.values(name)[0] ?? '';
}

/**
 * Platform order -> the page's order. Expects `state`, `shippingInfo.shippingMethod` and `paymentInfo.payments[*]`
 * expanded. Items are medication names only (no RX number, no dose text). Totals are the order's own.
 */
export function mapOrder(order: Order, locale: string): OrderView {
  const status = statusOfState(order.state?.obj?.key);
  const a = order.shippingAddress;
  const deliverTo = a?.streetName && a.city ? [a.streetName, `${a.city}${a.state ? `, ${a.state}` : ''} ${a.postalCode ?? ''}`.trim()].join(', ') : null;
  const total = order.taxedPrice?.totalGross ?? order.totalPrice;
  const shipment = order.shipmentState as ShipmentState | undefined;
  return {
    id: order.id,
    orderNumber: order.orderNumber ?? '',
    status,
    shipmentState: shipment && SHIPMENT.includes(shipment) ? shipment : null,
    createdAt: order.createdAt,
    lines: order.lineItems.map((l) => ({ name: localized(l.name, locale), quantity: l.quantity })),
    deliverTo,
    sameDay: order.shippingInfo?.shippingMethod?.obj?.key === 'mlv-same-day',
    total: mapMoney(total),
    refund: refundOf(paymentsOf(order)),
    cancellable: CANCELLABLE.includes(status),
  };
}

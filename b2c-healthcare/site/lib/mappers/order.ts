import type { Order, Payment } from '@commercetools/platform-sdk';
import { mapMoney } from '@/lib/mappers';
import { CANCELLABLE, type Instrument, type OrderLineView, type OrderStatus, type OrderView, type RefundStatus, type ShipmentState } from '@/lib/order-types';

const STATE_PREFIX = 'mlv-';
const STATUSES: readonly OrderStatus[] = ['received', 'pharmacist-review', 'packed-shipped', 'delivered', 'cancelled'];
const SHIPMENT: readonly ShipmentState[] = ['Pending', 'Ready', 'Shipped', 'Delivered', 'Partial', 'Backorder', 'Delayed'];

/** The order State key as a status. An order without a (known) state is shown as received: it exists and nothing else is known. */
export function statusOfState(key: string | undefined): OrderStatus {
  const bare = key?.startsWith(STATE_PREFIX) ? key.slice(STATE_PREFIX.length) : undefined;
  return STATUSES.find((s) => s === bare) ?? 'received';
}

const INTERNAL_METHODS = ['allowance', 'restricted-health-account'];

/**
 * What happened to the buyer's CARD money, from the card Payments' transactions (Checkout owns them, D-035):
 * an open `Refund` is "requested", a finished one "refunded"; a cancelled order whose card payment was only authorized
 * (nothing captured) is "released": the hold was cancelled and no refund exists. The allowance and the restricted
 * instrument are internal tenders and are shown by the tender rows instead.
 */
export function refundOf(payments: Pick<Payment, 'transactions' | 'paymentMethodInfo'>[], cancelled = false): RefundStatus {
  const card = payments.filter((p) => !INTERNAL_METHODS.includes(p.paymentMethodInfo?.method ?? ''));
  const refunds = card.flatMap((p) => p.transactions).filter((t) => t.type === 'Refund');
  if (refunds.some((t) => t.state === 'Initial' || t.state === 'Pending')) return 'requested';
  if (refunds.some((t) => t.state === 'Success')) return 'refunded';
  const captured = card.some((p) => p.transactions.some((t) => t.type === 'Charge' && t.state === 'Success'));
  const authorized = card.some((p) => p.transactions.some((t) => t.type === 'Authorization' && t.state === 'Success'));
  return cancelled && authorized && !captured ? 'released' : 'none';
}

export const paymentsOf = (order: Pick<Order, 'paymentInfo'>): Payment[] =>
  (order.paymentInfo?.payments ?? []).map((ref) => ref.obj).filter((p): p is Payment => p !== undefined);

const INSTRUMENTS: readonly Instrument[] = ['allowance', 'restricted-health-account', 'card'];

/** What the line records (workstream U): whether it qualified for the restricted instrument and which instruments settled it. */
function lineRecord(l: Order['lineItems'][number]): Pick<OrderLineView, 'eligible' | 'settledBy'> {
  const f = l.custom?.fields as Record<string, unknown> | undefined;
  if (!f) return {};
  let settledBy: Instrument[] | undefined;
  if (typeof f.settlement === 'string') {
    try {
      const parts = JSON.parse(f.settlement) as Record<string, unknown>;
      settledBy = INSTRUMENTS.filter((i) => typeof parts[i] === 'number' && (parts[i] as number) > 0);
    } catch {
      settledBy = undefined;
    }
  }
  return { ...(typeof f.eligibleForRestricted === 'boolean' ? { eligible: f.eligibleForRestricted } : {}), ...(settledBy ? { settledBy } : {}) };
}

function tenderOf(order: Order, total: { centAmount: number; currencyCode: string; fractionDigits: number }): OrderView['tender'] {
  const meta = order.custom?.fields as { allowanceApplied?: { centAmount?: number }; restrictedApplied?: { centAmount?: number } } | undefined;
  const allowance = meta?.allowanceApplied?.centAmount ?? 0;
  const restricted = meta?.restrictedApplied?.centAmount ?? 0;
  if (allowance === 0 && restricted === 0) return undefined;
  const money = (centAmount: number) => ({ centAmount, currencyCode: total.currencyCode, fractionDigits: total.fractionDigits });
  return { allowance: money(allowance), restricted: money(restricted), card: money(total.centAmount - allowance - restricted) };
}

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
    lines: order.lineItems.map((l) => ({ name: localized(l.name, locale), quantity: l.quantity, ...lineRecord(l) })),
    deliverTo,
    sameDay: order.shippingInfo?.shippingMethod?.obj?.key === 'mlv-same-day',
    total: mapMoney(total),
    refund: refundOf(paymentsOf(order), status === 'cancelled'),
    cancellable: CANCELLABLE.includes(status),
    ...(tenderOf(order, mapMoney(total)) ? { tender: tenderOf(order, mapMoney(total)) } : {}),
  };
}

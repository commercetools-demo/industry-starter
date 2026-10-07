import 'server-only';
import type { Order as CtOrder } from '@commercetools/platform-sdk';
import type { Money, Order, OrderLine, OrderListItem, OrderStatus } from '../types';
import { mapAddress, mapLine, mapSlot } from './cart';
import type { MapContext } from './product';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Order and shipment state to the shopper-facing status. Anything not listed is `unknown` (neutral tag; `statusRaw` is kept). */
export function mapOrderStatus(orderState: string | undefined, shipmentState: string | undefined): OrderStatus {
  if (orderState === 'Cancelled') return 'cancelled';
  if (shipmentState === 'Delivered') return 'delivered';
  if (shipmentState === 'Shipped') return 'on-its-way';
  if (shipmentState === 'Ready') return 'packing';
  if ((orderState === 'Open' || orderState === 'Confirmed') && (shipmentState === undefined || shipmentState === 'Pending')) return 'processing';
  return 'unknown';
}

/** "Whole milk, Bananas +2": the first two names, then the number of the others. */
export function itemSummary(names: string[]): string {
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}

const money = (m: { centAmount: number; currencyCode: string }): Money => ({ centAmount: m.centAmount, currencyCode: m.currencyCode });

function mapFinalTotal(custom: CtOrder['custom']): Money | undefined {
  const fields: unknown = custom?.fields;
  const value = isRecord(fields) ? fields.finalTotal : undefined;
  if (!isRecord(value) || typeof value.centAmount !== 'number' || typeof value.currencyCode !== 'string') return undefined;
  return { centAmount: value.centAmount, currencyCode: value.currencyCode };
}

const statusOf = (order: CtOrder): { status: OrderStatus; statusRaw: string } => ({
  status: mapOrderStatus(order.orderState, order.shipmentState),
  statusRaw: [order.orderState, order.shipmentState].filter(Boolean).join('/'),
});

function mapOrderLine(line: CtOrder['lineItems'][number], locale: string): OrderLine {
  const l = mapLine(line, locale);
  return {
    id: l.id,
    name: l.name,
    sku: l.sku,
    ...(l.image ? { image: l.image } : {}),
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    total: l.total,
    increment: l.increment,
    approximateWeight: l.approximateWeight,
    substitutionPreference: l.substitutionPreference,
  };
}

/** Pure mapping from an SDK order to the app `Order`. Totals are the server's values. */
export function mapOrder(order: CtOrder, ctx: Pick<MapContext, 'locale'>): Order {
  const lines = order.lineItems.map((l) => mapOrderLine(l, ctx.locale));
  const currencyCode = order.totalPrice.currencyCode;
  const tax = order.taxedPrice?.totalTax;
  const slot = mapSlot(order.custom);
  const finalTotal = mapFinalTotal(order.custom);
  return {
    id: order.id,
    ...(order.orderNumber ? { orderNumber: order.orderNumber } : {}),
    createdAt: order.createdAt,
    ...statusOf(order),
    lines,
    subtotal: { centAmount: lines.reduce((sum, l) => sum + l.total.centAmount, 0), currencyCode },
    ...(order.shippingInfo ? { shipping: money(order.shippingInfo.price) } : {}),
    ...(tax ? { tax: money(tax) } : {}),
    total: money(order.totalPrice),
    isProvisional: lines.some((l) => l.approximateWeight),
    ...(finalTotal ? { finalTotal } : {}),
    ...(order.shippingAddress ? { shippingAddress: mapAddress(order.shippingAddress) } : {}),
    ...(slot ? { slot } : {}),
    inventoryMode: order.inventoryMode ?? 'None',
    version: order.version,
    ...(order.customerId ? { customerId: order.customerId } : {}),
  };
}

export function mapOrderListItem(order: CtOrder, ctx: Pick<MapContext, 'locale'>): OrderListItem {
  return {
    id: order.id,
    ...(order.orderNumber ? { orderNumber: order.orderNumber } : {}),
    createdAt: order.createdAt,
    status: statusOf(order).status,
    total: money(order.totalPrice),
    itemSummary: itemSummary(order.lineItems.map((l) => mapLine(l, ctx.locale).name)),
  };
}

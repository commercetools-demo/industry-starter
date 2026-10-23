import type { Address, Delivery, LineItem, Order, ReturnInfo } from '@commercetools/platform-sdk';
import { canReturn, deriveOrderStatus, returnWindowEnds } from '@/lib/account/order-status';
import { trackingUrl } from '@/lib/account/tracking';
import { COLLECT_METHOD_KEY } from '@/lib/cart/plan';
import { hoursLabel } from '@/lib/mappers/checkout';
import { effectivePrice, fulfilmentOf } from '@/lib/mappers/cart';
import { mapChannel } from '@/lib/mappers/channel';
import { todayHours } from '@/lib/hours';
import { RETURN_WINDOW_DAYS } from '@/lib/shop-config';
import type {
  OrderDelivery, OrderLineView, OrderReturn, OrderState, OrderView, RecurrencePolicyView, ReturnPaymentState, ReturnShipmentState, Store,
} from '@/lib/types';
import { getLocalizedString } from '@/lib/utils';

/** Seeded order state keys (seed base.ts) to the app's four collection states. Anything else is null. */
const STATE_OF: Record<string, OrderState> = {
  'mcf-order-ordered': 'ordered',
  'mcf-order-preparing': 'preparing',
  'mcf-order-ready-for-collection': 'ready-for-collection',
  'mcf-order-collected': 'collected',
};

export function mapOrderState(key: string | undefined): OrderState | null {
  return key ? (STATE_OF[key] ?? null) : null;
}

export interface OrderMapContext {
  locale: string;
  now: Date;
  /** Other orders of the same purchase (complete-per-group). */
  linked?: { id: string; orderNumber: string }[];
}

function scheduleOf(l: LineItem): RecurrencePolicyView['schedule'] | null {
  const schedule = l.recurrenceInfo?.recurrencePolicy?.obj?.schedule;
  if (!schedule || schedule.type !== 'standard') return null;
  const unit = schedule.intervalUnit;
  if (unit === 'Weeks') return { unit: 'Weeks', value: schedule.value };
  if (unit === 'Months') return { unit: 'Months', value: schedule.value };
  return unit === 'Days' ? { unit: 'Days', value: schedule.value } : null;
}

function addressLine(a: Address | undefined): string {
  if (!a) return '';
  const street = [a.streetNumber, a.streetName].filter(Boolean).join(' ');
  return [street, [a.city, a.state].filter(Boolean).join(', '), a.postalCode].filter(Boolean).join(' · ');
}

function recipientOf(a: Address | undefined): NonNullable<OrderView['ship']>['recipient'] {
  if (!a) return null;
  return {
    name: [a.firstName, a.lastName].filter(Boolean).join(' '),
    line: [a.streetNumber, a.streetName].filter(Boolean).join(' '),
    city: a.city ?? '',
    state: a.state ?? null,
    postalCode: a.postalCode ?? '',
    country: a.country,
  };
}

function mapLine(l: LineItem, locale: string): OrderLineView {
  const image = l.variant?.images?.[0];
  const schedule = scheduleOf(l);
  const f = fulfilmentOf(l);
  const channel = f === 'collect' ? (l.supplyChannel?.obj ?? null) : null;
  return {
    id: l.id,
    sku: l.variant?.sku ?? '',
    name: getLocalizedString(l.name, locale),
    // The line carries no attribute labels (attributes are not saved on lines); the confirmation shows the name and quantity.
    variantSummary: '',
    quantity: l.quantity,
    imageUrl: image?.url ?? null,
    fulfilment: f,
    storeKey: l.supplyChannel?.obj?.key ?? null,
    storeName: channel ? getLocalizedString(channel.name, locale) : null,
    recurrence: schedule,
    unitCents: l.price.discounted?.value.centAmount ?? l.price.value.centAmount,
    priceCents: l.totalPrice.centAmount,
  };
}

function deliveriesOf(order: Order, names: Map<string, string>): OrderDelivery[] {
  const all: Delivery[] = [
    ...(order.shippingInfo?.deliveries ?? []),
    ...(order.shipping ?? []).flatMap((s) => s.shippingInfo.deliveries ?? []),
  ];
  const seen = new Set<string>();
  const out: OrderDelivery[] = [];
  for (const d of all) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    const tracked = d.parcels.map((p) => p.trackingData).find((t) => t?.trackingId);
    const carrier = tracked?.carrier ?? tracked?.provider ?? null;
    const trackingId = tracked?.trackingId ?? null;
    out.push({
      id: d.id,
      createdAt: d.createdAt,
      carrier,
      trackingId,
      trackingUrl: trackingUrl(carrier, trackingId),
      items: d.items.map((i) => ({ lineId: i.id, name: names.get(i.id) ?? '', quantity: i.quantity })),
    });
  }
  return out;
}

function returnsOf(info: ReturnInfo[] | undefined, names: Map<string, string>): OrderReturn[] {
  return (info ?? []).map((r, index) => ({
    id: `return-${index + 1}`,
    createdAt: r.returnDate ?? r.items[0]?.createdAt ?? '',
    trackingId: r.returnTrackingId ?? null,
    items: r.items.flatMap((i) =>
      i.type === 'LineItemReturnItem'
        ? [{
            id: i.id,
            lineId: i.lineItemId,
            name: names.get(i.lineItemId) ?? '',
            quantity: i.quantity,
            reason: i.comment ?? null,
            shipmentState: i.shipmentState as ReturnShipmentState,
            paymentState: i.paymentState as ReturnPaymentState,
          }]
        : [],
    ),
  }));
}

/** Units of each line still returnable: ordered minus everything in `returnInfo` (all return states count). */
export function returnableUnits(order: Pick<Order, 'lineItems' | 'returnInfo'>): Record<string, number> {
  const returned = new Map<string, number>();
  for (const r of order.returnInfo ?? []) {
    for (const i of r.items) {
      if (i.type === 'LineItemReturnItem') returned.set(i.lineItemId, (returned.get(i.lineItemId) ?? 0) + i.quantity);
    }
  }
  return Object.fromEntries(order.lineItems.map((l) => [l.id, Math.max(0, l.quantity - (returned.get(l.id) ?? 0))]));
}

/** A stored order to the view. Pure: works from the order alone (an order revisited later needs no cart). */
export function mapOrder(o: Order, ctx: OrderMapContext): OrderView {
  const lines = o.lineItems.map((l) => mapLine(l, ctx.locale));
  const methodKey = o.shippingInfo?.shippingMethod?.obj?.key;
  const collectOrder = methodKey === COLLECT_METHOD_KEY;

  const stores = new Map<string, Store>();
  for (const l of o.lineItems) {
    const channel = l.supplyChannel?.obj;
    if (fulfilmentOf(l) === 'collect' && channel && !stores.has(channel.id)) {
      const store = mapChannel(channel, ctx.locale);
      if (store) stores.set(channel.id, store);
    }
  }
  // A collect line whose store channel cannot be mapped still names its store (name only).
  const unmapped = o.lineItems.flatMap((l) => {
    const channel = l.supplyChannel?.obj;
    return fulfilmentOf(l) === 'collect' && channel && !stores.has(channel.id) ? [channel] : [];
  });
  const pickupName = collectOrder ? [o.shippingAddress?.firstName, o.shippingAddress?.lastName].filter(Boolean).join(' ') || null : null;
  const collect: OrderView['collect'] = [...stores.values()].map((s) => ({
    storeKey: s.key,
    storeName: s.name,
    address: [s.addressLine, s.city].filter(Boolean).join(', '),
    hours: hoursLabel(todayHours(s, ctx.now, s.timeZone)),
    phone: s.phone ?? null,
    readyMinutes: s.collectionMinutes,
    pickupName,
    lat: s.geo?.lat ?? null,
    lng: s.geo?.lng ?? null,
  }));
  for (const channel of unmapped) {
    if (collect.some((c) => c.storeKey === channel.key)) continue;
    collect.push({
      storeKey: channel.key, storeName: getLocalizedString(channel.name, ctx.locale), address: '', hours: null, phone: null,
      readyMinutes: null, pickupName, lat: null, lng: null,
    });
  }

  const names = new Map(lines.map((l) => [l.id, l.name]));
  const deliveries = deliveriesOf(o, names);
  const shipsSomething = o.lineItems.some((l) => fulfilmentOf(l) !== 'collect');
  const info = o.shippingInfo;
  const estimate = info?.shippingMethod?.obj?.localizedDescription;
  const ship: OrderView['ship'] =
    shipsSomething && info && !collectOrder
      ? {
          methodName: info.shippingMethodName,
          estimate: estimate ? getLocalizedString(estimate, ctx.locale) || null : null,
          address: addressLine(o.shippingAddress),
          recipient: recipientOf(o.shippingAddress),
        }
      : null;

  const goods = o.lineItems.reduce((n, l) => n + l.totalPrice.centAmount, 0);
  const saved = o.lineItems.reduce((n, l) => n + Math.max(0, effectivePrice(l).centAmount * l.quantity - l.totalPrice.centAmount), 0);
  const shippingCents = info ? (info.discountedPrice?.value.centAmount ?? info.price.centAmount) : 0;
  const taxCents = o.taxedPrice?.totalTax?.centAmount ?? 0;
  const totalCents = o.taxedPrice ? o.taxedPrice.totalGross.centAmount : o.totalPrice.centAmount + shippingCents;

  const state = mapOrderState(o.state?.obj?.key);
  const hasCollect = o.lineItems.some((l) => fulfilmentOf(l) === 'collect');
  const status = deriveOrderStatus({ orderState: o.orderState, stateKey: state, shipmentState: o.shipmentState ?? null, hasCollect, hasShip: shipsSomething });
  const returnable = returnableUnits(o);
  // The order's completion time is approximated by its last modification (Q-L-15).
  const completedAt = o.lastModifiedAt;
  const windowEnd = status === 'completed' ? returnWindowEnds(completedAt, RETURN_WINDOW_DAYS).toISOString() : null;
  return {
    id: o.id,
    orderNumber: o.orderNumber ?? o.id,
    createdAt: o.createdAt,
    email: o.customerEmail ?? null,
    locale: o.locale ?? '',
    currency: o.totalPrice.currencyCode,
    customerId: o.customerId ?? null,
    state,
    paymentState: o.paymentState ?? null,
    shipmentState: o.shipmentState ?? null,
    status,
    hasCollect,
    hasShip: shipsSomething,
    lines,
    collect,
    ship,
    deliveries,
    subscriptions: o.lineItems.flatMap((l) => {
      const schedule = scheduleOf(l);
      return schedule ? [{ lineId: l.id, schedule }] : [];
    }),
    totals: { subtotalCents: goods + saved, discountCents: saved, shippingCents, taxCents, totalCents },
    linked: ctx.linked ?? [],
    returns: returnsOf(o.returnInfo, names),
    canReturn: canReturn({ status, completedAt, returnable }, ctx.now, RETURN_WINDOW_DAYS),
    returnWindowEndsAt: windowEnd,
    returnable,
  };
}

import { brandOfLineFields } from '@/lib/brands';
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
import { childrenOf, isBundleChild, isBundleParent } from '@/lib/mappers/bundle-lines';

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
    // Only a collect line's channel is a store (a brand's inventory channel is not).
    storeKey: f === 'collect' ? (l.supplyChannel?.obj?.key ?? null) : null,
    brand: brandOfLineFields(l.custom?.fields),
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
/** The bundle row of a parent line: its parts folded into `bundle`, machine first (workstream V, D8). */
function withBundle(line: OrderLineView, parent: LineItem, parts: LineItem[], locale: string): OrderLineView {
  const machineSku = String(parent.custom?.fields?.bundleMachineSku ?? '');
  const items = parts.map((p) => ({
    sku: p.variant?.sku ?? '',
    name: getLocalizedString(p.name, locale),
    ...(p.variant?.images?.[0]?.url ? { imageUrl: p.variant.images[0].url } : {}),
    role: (p.variant?.sku ?? '') === machineSku ? ('machine' as const) : ('item' as const),
  })).sort((a, b) => Number(b.role === 'machine') - Number(a.role === 'machine'));
  const machine = items.find((i) => i.role === 'machine');
  const discount = parent.custom?.fields?.bundleDiscount;
  return {
    ...line,
    ...(machine?.imageUrl ? { imageUrl: machine.imageUrl } : {}),
    // The preset's name is in the bundle configuration, not on the order: the order shows the generic name.
    bundle: { presetName: 'Bundle', discountPercent: typeof discount === 'number' ? Math.round(discount * 100) : 0, items },
  };
}

/**
 * Returnable units per line. A bundle's parts are not listed: the bundle row (its parent) is returned as one, and the
 * return writes every part at the same quantity (workstream V, Q-V-7).
 */
export function returnableUnits(order: Pick<Order, 'lineItems' | 'returnInfo'>): Record<string, number> {
  const returned = new Map<string, number>();
  for (const r of order.returnInfo ?? []) {
    for (const i of r.items) {
      if (i.type === 'LineItemReturnItem') returned.set(i.lineItemId, (returned.get(i.lineItemId) ?? 0) + i.quantity);
    }
  }
  return Object.fromEntries(order.lineItems.filter((l) => !isBundleChild(l)).map((l) => [l.id, Math.max(0, l.quantity - (returned.get(l.id) ?? 0))]));
}

/** A stored order to the view. Pure: works from the order alone (an order revisited later needs no cart). */
/** The `orderType` custom field of the In-store companion (D-042), when it holds one of the two known values. */
export function orderTypeOf(custom: Pick<NonNullable<Order['custom']>, 'fields'> | undefined): 'in-store-purchase' | 'online' | null {
  const v = custom?.fields?.['orderType'];
  return v === 'in-store-purchase' || v === 'online' ? v : null;
}

/** A `Multiple` order's shipping entry of a collect group: the collect method, or our `collect-<store>` key (method not expanded). */
function isCollectEntry(e: NonNullable<Order['shipping']>[number]): boolean {
  return e.shippingInfo.shippingMethod?.obj?.key === COLLECT_METHOD_KEY || e.shippingKey.startsWith('collect-');
}

export function mapOrder(o: Order, ctx: OrderMapContext): OrderView {
  // The rows: a bundle's parts are folded into the bundle row (workstream V, D8).
  const lines = o.lineItems.filter((l) => !isBundleChild(l)).map((l) => {
    const line = mapLine(l, ctx.locale);
    return isBundleParent(l) ? withBundle(line, l, childrenOf(o.lineItems, l), ctx.locale) : line;
  });
  // Shipping: a `Single` order has one `shippingInfo`; a `Multiple` order (D-062) has one `shipping[]` entry per fulfilment group.
  const entries = o.shipping ?? [];
  const multiple = entries.length > 0;
  const collectEntries = entries.filter(isCollectEntry);
  const deliveryEntry = entries.find((e) => !isCollectEntry(e));
  const collectOrder = multiple ? collectEntries.length > 0 : o.shippingInfo?.shippingMethod?.obj?.key === COLLECT_METHOD_KEY;

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
  const nameOf = (a: { firstName?: string; lastName?: string } | undefined) => [a?.firstName, a?.lastName].filter(Boolean).join(' ') || null;
  const pickupName = !collectOrder ? null : multiple ? nameOf(collectEntries[0]?.shippingAddress) : nameOf(o.shippingAddress);
  const collect: OrderView['collect'] = [...stores.values()].map((s) => ({
    storeKey: s.key,
    storeName: s.name,
    address: [s.addressLine, s.city].filter(Boolean).join(', '),
    hours: hoursLabel(todayHours(s, ctx.now, s.timeZone)),
    phone: s.phone ?? null,
    readyMinutes: s.collectionMinutes,
    pickupName: multiple ? (nameOf(collectEntries.find((e) => e.shippingKey === `collect-${s.key}`)?.shippingAddress) ?? pickupName) : pickupName,
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

  const names = new Map(o.lineItems.map((l) => [l.id, getLocalizedString(l.name, ctx.locale)]));
  const deliveries = deliveriesOf(o, names);
  const shipsSomething = o.lineItems.some((l) => fulfilmentOf(l) !== 'collect');
  // The delivery group's shipping: the `delivery` entry of a `Multiple` order, else the order's own `shippingInfo` (not for a collect order).
  const info = multiple ? deliveryEntry?.shippingInfo : o.shippingInfo;
  const shipAddress = multiple ? deliveryEntry?.shippingAddress : o.shippingAddress;
  const estimate = info?.shippingMethod?.obj?.localizedDescription;
  const ship: OrderView['ship'] =
    shipsSomething && info && (multiple || !collectOrder)
      ? {
          methodName: info.shippingMethodName,
          estimate: estimate ? getLocalizedString(estimate, ctx.locale) || null : null,
          address: addressLine(shipAddress),
          recipient: recipientOf(shipAddress),
        }
      : null;

  const goods = o.lineItems.reduce((n, l) => n + l.totalPrice.centAmount, 0);
  const saved = o.lineItems.reduce((n, l) => n + Math.max(0, effectivePrice(l).centAmount * l.quantity - l.totalPrice.centAmount), 0);
  const priceOf = (i: { discountedPrice?: { value: { centAmount: number } }; price?: { centAmount: number } }) => i.discountedPrice?.value.centAmount ?? i.price?.centAmount ?? 0;
  const shippingCents = multiple ? entries.reduce((n, e) => n + priceOf(e.shippingInfo), 0) : o.shippingInfo ? priceOf(o.shippingInfo) : 0;
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
    ...(orderTypeOf(o.custom) ? { orderType: orderTypeOf(o.custom) } : {}),
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

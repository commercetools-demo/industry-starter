import type { Channel, Delivery, LineItem, Order, ReturnInfo } from '@commercetools/platform-sdk';
import { canReturn, deriveOrderStatus, returnWindowEnds } from '@/lib/account/order-status';
import { trackingUrl } from '@/lib/account/tracking';
import { todayHours } from '@/lib/hours';
import { fulfilmentOf } from '@/lib/mappers/cart';
import { mapChannel } from '@/lib/mappers/channel';
import { RETURN_WINDOW_DAYS } from '@/lib/shop-config';
import type {
  OrderCollectInfo, OrderDelivery, OrderDetailView, OrderLineView, OrderListItem, OrderReturn, OrderStateKey,
  ReturnPaymentState, ReturnShipmentState,
} from '@/lib/types';
import { getLocalizedString } from '@/lib/utils';

const STATE_PREFIX = 'mcf-order-';
const STATE_KEYS: readonly OrderStateKey[] = ['ordered', 'preparing', 'ready-for-collection', 'collected'];

/** The seeded state of the order (state expanded), or null when it has none yet (the hosted Checkout creates none). */
export function stateKeyOf(order: Pick<Order, 'state'>): OrderStateKey | null {
  const key = order.state?.obj?.key;
  if (!key || !key.startsWith(STATE_PREFIX)) return null;
  const short = key.slice(STATE_PREFIX.length);
  return (STATE_KEYS as readonly string[]).includes(short) ? (short as OrderStateKey) : null;
}

const channelOf = (l: LineItem): Channel | null => l.supplyChannel?.obj ?? null;

function collectInfo(order: Order, locale: string, now: Date): OrderCollectInfo | null {
  const line = order.lineItems.find((l) => fulfilmentOf(l) === 'collect');
  if (!line) return null;
  const channel = channelOf(line);
  const store = channel ? mapChannel(channel, locale) : null;
  if (!store) return { storeName: channel ? getLocalizedString(channel.name, locale) : '', hours: null, lat: null, lng: null };
  const window = todayHours(store, now, store.timeZone);
  return {
    storeName: store.name,
    hours: window ? `${window.open}–${window.close}` : null,
    lat: store.geo?.lat ?? null,
    lng: store.geo?.lng ?? null,
  };
}

function statusOf(order: Order) {
  const hasCollect = order.lineItems.some((l) => fulfilmentOf(l) === 'collect');
  const hasShip = order.lineItems.some((l) => fulfilmentOf(l) !== 'collect');
  const stateKey = stateKeyOf(order);
  const shipmentState = order.shipmentState ?? null;
  return {
    hasCollect, hasShip, stateKey, shipmentState,
    status: deriveOrderStatus({ orderState: order.orderState, stateKey, shipmentState, hasCollect, hasShip }),
  };
}

const totalOf = (order: Order): number => order.taxedPrice?.totalGross.centAmount ?? order.totalPrice.centAmount;

export function mapOrderListItem(order: Order, locale: string, now = new Date()): OrderListItem {
  const s = statusOf(order);
  return {
    id: order.id,
    orderNumber: order.orderNumber ?? order.id,
    createdAt: order.createdAt,
    totalCents: totalOf(order),
    currency: order.totalPrice.currencyCode,
    status: s.status,
    hasCollect: s.hasCollect,
    hasShip: s.hasShip,
    thumbs: order.lineItems.slice(0, 5).map((l) => ({
      imageUrl: l.variant.images?.[0]?.url ?? null,
      name: getLocalizedString(l.name, locale),
    })),
    itemCount: order.lineItems.reduce((n, l) => n + l.quantity, 0),
    collect: s.hasCollect ? collectInfo(order, locale, now) : null,
  };
}

function mapLine(l: LineItem, locale: string): OrderLineView {
  const f = fulfilmentOf(l);
  const channel = f === 'collect' ? channelOf(l) : null;
  return {
    id: l.id,
    sku: l.variant.sku ?? '',
    name: getLocalizedString(l.name, locale),
    imageUrl: l.variant.images?.[0]?.url ?? null,
    quantity: l.quantity,
    unitCents: l.price.discounted?.value.centAmount ?? l.price.value.centAmount,
    totalCents: l.totalPrice.centAmount,
    fulfilment: f,
    storeName: channel ? getLocalizedString(channel.name, locale) : null,
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
    const parcel = d.parcels.map((p) => p.trackingData).find((t) => t?.trackingId);
    const carrier = parcel?.carrier ?? parcel?.provider ?? null;
    const trackingId = parcel?.trackingId ?? null;
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

export function mapOrderDetail(order: Order, locale: string, now = new Date()): OrderDetailView {
  const s = statusOf(order);
  const lines = order.lineItems.map((l) => mapLine(l, locale));
  const names = new Map(lines.map((l) => [l.id, l.name]));
  const returnable = returnableUnits(order);
  const completedAt = order.lastModifiedAt;
  const windowEnd = s.status === 'completed' ? returnWindowEnds(completedAt, RETURN_WINDOW_DAYS).toISOString() : null;
  const collect = s.hasCollect ? collectInfo(order, locale, now) : null;
  const address = order.shippingAddress;
  const collectLine = order.lineItems.find((l) => fulfilmentOf(l) === 'collect');
  const collectChannel = collectLine ? channelOf(collectLine) : null;
  const collectStore = collectChannel ? mapChannel(collectChannel, locale) : null;
  return {
    id: order.id,
    orderNumber: order.orderNumber ?? order.id,
    createdAt: order.createdAt,
    currency: order.totalPrice.currencyCode,
    status: s.status,
    stateKey: s.stateKey,
    shipmentState: s.shipmentState,
    paymentState: order.paymentState ?? null,
    hasCollect: s.hasCollect,
    hasShip: s.hasShip,
    lines,
    subtotalCents: lines.reduce((n, l) => n + l.totalCents, 0),
    shippingCents: order.shippingInfo?.price.centAmount ?? null,
    taxCents: order.taxedPrice?.totalTax?.centAmount ?? null,
    totalCents: totalOf(order),
    collect: collect
      ? {
          ...collect,
          addressLine: collectStore ? [collectStore.addressLine, collectStore.city].filter(Boolean).join(', ') : null,
          phone: collectStore?.phone ?? null,
        }
      : null,
    shippingAddress:
      s.hasShip && address
        ? {
            name: [address.firstName, address.lastName].filter(Boolean).join(' '),
            line: [address.streetNumber, address.streetName].filter(Boolean).join(' '),
            city: address.city ?? '',
            state: address.state ?? null,
            postalCode: address.postalCode ?? '',
            country: address.country,
          }
        : null,
    deliveries: deliveriesOf(order, names),
    returns: returnsOf(order.returnInfo, names),
    canReturn: canReturn({ status: s.status, completedAt, returnable }, now, RETURN_WINDOW_DAYS),
    returnWindowEndsAt: windowEnd,
    returnable,
  };
}

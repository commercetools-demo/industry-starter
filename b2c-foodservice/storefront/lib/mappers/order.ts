import type { Address, LineItem, Order } from '@commercetools/platform-sdk';
import { COLLECT_METHOD_KEY } from '@/lib/cart/plan';
import { hoursLabel } from '@/lib/mappers/checkout';
import { effectivePrice, fulfilmentOf } from '@/lib/mappers/cart';
import { mapChannel } from '@/lib/mappers/channel';
import { todayHours } from '@/lib/hours';
import type { OrderLineView, OrderState, OrderView, RecurrencePolicyView, Store } from '@/lib/types';
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

function mapLine(l: LineItem, locale: string): OrderLineView {
  const image = l.variant?.images?.[0];
  const schedule = scheduleOf(l);
  return {
    id: l.id,
    name: getLocalizedString(l.name, locale),
    // The line carries no attribute labels (attributes are not saved on lines); the confirmation shows the name and quantity.
    variantSummary: '',
    quantity: l.quantity,
    imageUrl: image?.url ?? null,
    fulfilment: fulfilmentOf(l),
    storeKey: l.supplyChannel?.obj?.key ?? null,
    recurrence: schedule,
    priceCents: l.totalPrice.centAmount,
  };
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
  const pickupName = collectOrder ? [o.shippingAddress?.firstName, o.shippingAddress?.lastName].filter(Boolean).join(' ') || null : null;
  const collect = [...stores.values()].map((s) => ({
    storeKey: s.key,
    storeName: s.name,
    address: [s.addressLine, s.city].filter(Boolean).join(', '),
    hours: hoursLabel(todayHours(s, ctx.now, s.timeZone)),
    phone: s.phone ?? null,
    readyMinutes: s.collectionMinutes,
    pickupName,
  }));

  const shipsSomething = o.lineItems.some((l) => fulfilmentOf(l) !== 'collect');
  const info = o.shippingInfo;
  const estimate = info?.shippingMethod?.obj?.localizedDescription;
  const ship: OrderView['ship'] =
    shipsSomething && info && !collectOrder
      ? {
          methodName: info.shippingMethodName,
          estimate: estimate ? getLocalizedString(estimate, ctx.locale) || null : null,
          address: addressLine(o.shippingAddress),
          deliveries: (info.deliveries ?? []).map((d) => {
            const parcel = d.parcels?.[0];
            return {
              id: d.id,
              trackingId: parcel?.trackingData?.trackingId ?? null,
              trackingUrl: null,
              carrier: parcel?.trackingData?.carrier ?? null,
            };
          }),
        }
      : null;

  const goods = o.lineItems.reduce((n, l) => n + l.totalPrice.centAmount, 0);
  const saved = o.lineItems.reduce((n, l) => n + Math.max(0, effectivePrice(l).centAmount * l.quantity - l.totalPrice.centAmount), 0);
  const shippingCents = info ? (info.discountedPrice?.value.centAmount ?? info.price.centAmount) : 0;
  const taxCents = o.taxedPrice?.totalTax?.centAmount ?? 0;
  const totalCents = o.taxedPrice ? o.taxedPrice.totalGross.centAmount : o.totalPrice.centAmount + shippingCents;

  return {
    id: o.id,
    orderNumber: o.orderNumber ?? o.id,
    createdAt: o.createdAt,
    email: o.customerEmail ?? null,
    locale: o.locale ?? '',
    currency: o.totalPrice.currencyCode,
    customerId: o.customerId ?? null,
    state: mapOrderState(o.state?.obj?.key),
    paymentState: o.paymentState ?? null,
    shipmentState: o.shipmentState ?? null,
    lines,
    collect,
    ship,
    subscriptions: o.lineItems.flatMap((l) => {
      const schedule = scheduleOf(l);
      return schedule ? [{ lineId: l.id, schedule }] : [];
    }),
    totals: { subtotalCents: goods + saved, discountCents: saved, shippingCents, taxCents, totalCents },
    linked: ctx.linked ?? [],
  };
}

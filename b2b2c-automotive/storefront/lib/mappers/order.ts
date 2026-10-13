// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// commercetools order (read with `ORDER_CONFIRMATION_EXPAND`) to the confirmation view model (workstream P-03). Pure. Currency, tax label,
// number and names are the order's own; pickup or shipping is decided by the order's shipping method key (D5), never by the cart preset.
import type { Attribute, Cart as CtCart, Order as CtOrder, RecurringOrder as CtRecurringOrder } from '@commercetools/platform-sdk';
import { collectSavings } from '@/lib/mappers/cart-savings';
import { taxLabel } from '@/lib/mappers/cart';
import { mapMoney } from '@/lib/mappers/money';
import type { Branch, Money, OrderLineView, OrderPayment, OrderStatus, OrderSubscriptionView, OrderView } from '@/lib/types';
import { getLocalizedString } from '@/lib/utils';

export type { OrderStatus, OrderView } from '@/lib/types';

/** Seed-owned `OrderState` (workstream F, shared with Q): the portal sets it, the confirmation page and the account read it. */
export const ORDER_STATE_READY_FOR_PICKUP = 'ready-for-pickup';
/** Keys of the seeded shipping methods (the same constants as `lib/ct/delivery`, which is server-only). */
const SHIP_PICKUP_KEY = 'mau-ship-pickup';

/** The expansions the confirmation read needs: shipping method (pickup or ship), state, named discounts, subscription frequency. */
export const ORDER_CONFIRMATION_EXPAND = [
  'shippingInfo.shippingMethod',
  'state',
  'lineItems[*].price.discounted.discount',
  'lineItems[*].discountedPricePerQuantity[*].discountedPrice.includedDiscounts[*].discount',
  'lineItems[*].recurrenceInfo.recurrencePolicy',
  'discountOnTotalPrice.includedDiscounts[*].discount',
  'shippingInfo.discountedPrice.includedDiscounts[*].discount',
];

export interface OrderMapContext {
  locale: string;
  /** The branch of the order's `pickupBranchKey`, when it is one of the store's branches. */
  branch: Branch | null;
  recurring: CtRecurringOrder | null;
  storeName: string;
  /** The store's ship days; `null` omits the window from the sentence. */
  shipDays: { min: number; max: number } | null;
  timezone: string;
  /** Name of a discount that has none. */
  savingFallback: string;
}

const attribute = (attrs: Attribute[] | undefined, name: string): unknown => attrs?.find((a) => a.name === name)?.value;
const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
function brandOf(attrs: Attribute[] | undefined): string | null {
  const brand = attribute(attrs, 'brand');
  if (typeof brand === 'object' && brand !== null) {
    const { label, key } = brand as { label?: unknown; key?: unknown };
    return text(label) ?? text(key) ?? null;
  }
  return text(brand) ?? text(attribute(attrs, 'brand-name')) ?? null;
}

const shippingMethodKey = (o: CtOrder): string | null => (o.shippingInfo?.shippingMethod as { obj?: { key?: string } } | undefined)?.obj?.key ?? null;

/** Pickup only when the order's shipping method is the pickup method (D5). */
export const isPickupOrder = (o: CtOrder): boolean => shippingMethodKey(o) === SHIP_PICKUP_KEY;

/** Cancelled; delivered (collected for pickup orders); the `ready-for-pickup` state; shipped; else placed. */
export function mapOrderStatus(o: CtOrder): OrderStatus {
  if (o.orderState === 'Cancelled') return 'cancelled';
  if (o.shipmentState === 'Delivered') return isPickupOrder(o) ? 'collected' : 'delivered';
  if ((o.state as { obj?: { key?: string } } | undefined)?.obj?.key === ORDER_STATE_READY_FOR_PICKUP) return 'ready-for-pickup';
  if (o.shipmentState === 'Shipped') return 'shipped';
  return 'placed';
}

function mapPayment(o: CtOrder): OrderPayment {
  if (o.paymentState === 'Failed') return 'failed';
  if (o.paymentState === 'Paid' || o.paymentState === 'CreditOwed') return 'paid';
  return 'pending';
}

function mapLine(line: CtOrder['lineItems'][number], locale: string): OrderLineView {
  const policy = line.recurrenceInfo?.recurrencePolicy as { id: string; obj?: { key?: string; name?: Record<string, string> } } | undefined;
  return {
    id: line.id,
    brand: brandOf(line.variant.attributes),
    name: getLocalizedString(line.name, locale),
    imageUrl: line.variant.images?.[0]?.url ?? null,
    quantity: line.quantity,
    total: mapMoney(line.totalPrice),
    recurrence: line.recurrenceInfo ? { policyName: getLocalizedString(policy?.obj?.name, locale) || policy?.obj?.key || '' } : null,
  };
}

function mapTax(o: CtOrder): OrderView['totals']['tax'] {
  const taxed = o.taxedPrice;
  if (!taxed) return null;
  const portions = taxed.taxPortions ?? [];
  const rates = new Set(portions.map((p) => p.rate));
  const amount: Money = taxed.totalTax ? mapMoney(taxed.totalTax) : { ...mapMoney(taxed.totalGross), centAmount: taxed.totalGross.centAmount - taxed.totalNet.centAmount };
  if (rates.size !== 1) return { label: '', rate: null, amount };
  const [rate] = [...rates];
  return { label: taxLabel(portions[0]?.name ?? o.lineItems[0]?.taxRate?.name, rate), rate, amount };
}

function mapSubscription(lines: OrderLineView[], recurring: CtRecurringOrder | null): OrderSubscriptionView | null {
  const names = lines.flatMap((l) => (l.recurrence ? [l.recurrence.policyName] : []));
  if (names.length === 0) return null;
  const frequencies = [...new Set(names)];
  if (!recurring) return { frequencies, state: 'setting-up', nextOrderAt: null };
  const state = recurring.recurringOrderState;
  if (state === 'Paused') return { frequencies, state: 'paused', nextOrderAt: null };
  if (state === 'Canceled' || state === 'Expired' || state === 'Failed') return { frequencies, state: 'ended', nextOrderAt: null };
  return { frequencies, state: 'scheduled', nextOrderAt: recurring.nextOrderAt ?? null };
}

export function mapOrderView(o: CtOrder, ctx: OrderMapContext): OrderView {
  const pickup = isPickupOrder(o);
  const lines = o.lineItems.map((line) => mapLine(line, ctx.locale));
  const currency = o.totalPrice.currencyCode;
  const digits = o.totalPrice.fractionDigits;
  const money = (centAmount: number): Money => ({ centAmount, currencyCode: currency, fractionDigits: digits });
  const address = o.shippingAddress;
  const street = [address?.streetName, address?.streetNumber].filter(Boolean).join(' ');
  const name = [address?.firstName, address?.lastName].filter(Boolean).join(' ');
  return {
    id: o.id,
    number: o.orderNumber ?? '',
    storeKey: o.store?.key ?? '',
    status: mapOrderStatus(o),
    mode: pickup ? 'pickup' : 'ship',
    payment: mapPayment(o),
    shippingMethodKey: shippingMethodKey(o),
    email: o.customerEmail ?? null,
    hasCustomer: Boolean(o.customerId),
    lines,
    totals: {
      subtotal: money(o.lineItems.reduce((sum, line) => sum + line.price.value.centAmount * line.quantity, 0)),
      // The order carries the same discount structure as the cart it came from; the cart helper only reads those fields.
      savings: collectSavings(o as unknown as CtCart, ctx.locale, ctx.savingFallback),
      delivery: o.shippingInfo ? mapMoney(o.shippingInfo.price) : money(0),
      tax: mapTax(o),
      total: mapMoney(o.taxedPrice?.totalGross ?? o.totalPrice),
      pricesIncludeTax: o.lineItems[0]?.taxRate?.includedInPrice ?? false,
    },
    pickup: pickup && ctx.branch ? { branchName: ctx.branch.name, address: ctx.branch.address, hours: ctx.branch.hours, phone: ctx.branch.phone, timezone: ctx.branch.timezone } : null,
    shipTo: !pickup && address ? { name: name || null, street, postalCode: address.postalCode ?? '', city: address.city ?? '', country: address.country } : null,
    shipWindow: ctx.shipDays,
    storeName: ctx.storeName,
    subscription: mapSubscription(lines, ctx.recurring),
    timezone: ctx.timezone,
  };
}

export { buildTimeline, nextStepSentence } from '@/lib/order/next-step';

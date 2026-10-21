import type { Cart, LineItem, Order, RecurrencePolicySchedule, RecurringOrder } from '@commercetools/platform-sdk';
import { mapMoney } from '@/lib/mappers/money';
import type { PendingSubscription, Subscription, SubscriptionLine, SubscriptionState } from '@/lib/types';
import { getLocalizedString } from '@/lib/utils';

/**
 * Recurring order (commercetools) to the `Subscription` the account shows (workstream N). Pure. The recurring order is read
 * with `expand: ['cart', 'originOrder']`; the lines come from the recurring cart (the blueprint of every later order).
 */

const STATE_OF: Record<string, SubscriptionState> = {
  Active: 'active',
  Paused: 'paused',
  Canceled: 'canceled',
  Expired: 'expired',
  Failed: 'failed',
};

/** `Canceled` has one "l" in the API and in the state name (the UI word is the same). */
export function mapSubscriptionState(state: string): SubscriptionState {
  return STATE_OF[state] ?? 'failed';
}

export function mapSchedule(schedule: RecurrencePolicySchedule | undefined): Subscription['schedule'] {
  if (!schedule || schedule.type !== 'standard') return null;
  const unit = schedule.intervalUnit;
  if (unit === 'Days') return { unit: 'Days', value: schedule.value };
  if (unit === 'Weeks') return { unit: 'Weeks', value: schedule.value };
  return unit === 'Months' ? { unit: 'Months', value: schedule.value } : null;
}

function scheduleKey(s: RecurrencePolicySchedule | undefined): string {
  return s && s.type === 'standard' ? `${s.intervalUnit}:${s.value}` : (s?.type ?? '');
}

/** "50 capsules", "250 g, Filter" from the variant attributes a line carries. Empty when none of them is present. */
export function variantLabelOf(line: LineItem, locale: string): string {
  const attrs = new Map((line.variant?.attributes ?? []).map((a) => [a.name, a.value as unknown]));
  const parts: string[] = [];
  const packs = attrs.get('capsulesPerPack');
  if (typeof packs === 'number') parts.push(`${packs} capsules`);
  const size = attrs.get('sizeGrams');
  if (typeof size === 'number') parts.push(size >= 1000 && size % 1000 === 0 ? `${size / 1000} kg` : `${size} g`);
  const grind = attrs.get('grind');
  if (grind && typeof grind === 'object') {
    const label = (grind as { label?: unknown; key?: unknown }).label;
    const text = typeof label === 'string' ? label : label && typeof label === 'object' ? getLocalizedString(label as Record<string, string>, locale) : '';
    if (text) parts.push(text);
  }
  return parts.join(', ');
}

function mapLine(l: LineItem, locale: string): SubscriptionLine {
  return {
    lineId: l.id,
    sku: l.variant?.sku ?? '',
    productId: l.productId,
    slug: l.productSlug ? getLocalizedString(l.productSlug, locale) || null : null,
    name: getLocalizedString(l.name, locale),
    variantLabel: variantLabelOf(l, locale),
    imageUrl: l.variant?.images?.[0]?.url ?? null,
    quantity: l.quantity,
    unitPrice: mapMoney(l.price.discounted?.value ?? l.price.value),
    totalPrice: mapMoney(l.totalPrice),
  };
}

/** The recurring cart's lines, or the origin order's recurring lines of this schedule when the cart was not expanded. */
export function linesOf(raw: RecurringOrder): { lines: LineItem[]; source: 'cart' | 'originOrder' | 'none' } {
  const cart: Cart | undefined = raw.cart?.obj;
  if (cart && cart.lineItems.length > 0) return { lines: cart.lineItems, source: 'cart' };
  const origin: Order | undefined = raw.originOrder?.obj;
  if (origin) {
    const key = scheduleKey(raw.schedule);
    const recurring = origin.lineItems.filter((l) => l.recurrenceInfo);
    const sameSchedule = recurring.filter((l) => {
      const s = l.recurrenceInfo?.recurrencePolicy?.obj?.schedule;
      return s ? scheduleKey(s) === key : true;
    });
    return { lines: sameSchedule, source: 'originOrder' };
  }
  return { lines: [], source: 'none' };
}

export function mapRecurringOrder(raw: RecurringOrder, locale: string): Subscription {
  const { lines } = linesOf(raw);
  const first = lines.find((l) => l.recurrenceInfo)?.recurrenceInfo;
  const counter = raw.skipConfiguration?.type === 'Counter' ? raw.skipConfiguration : undefined;
  const mode = first?.priceSelectionMode;
  const cart = raw.cart?.obj;
  const total = cart?.totalPrice
    ? mapMoney(cart.totalPrice)
    : { centAmount: lines.reduce((sum, l) => sum + l.totalPrice.centAmount, 0), currencyCode: lines[0]?.totalPrice.currencyCode ?? 'USD' };
  return {
    id: raw.id,
    version: raw.version,
    state: mapSubscriptionState(raw.recurringOrderState),
    policyId: first?.recurrencePolicy.id ?? null,
    schedule: mapSchedule(raw.schedule),
    nextOrderDate: raw.nextOrderAt ?? null,
    lastOrderDate: raw.lastOrderAt ?? null,
    startedAt: raw.startsAt,
    pendingSkips: counter ? Math.max(0, counter.totalToSkip - counter.skipped) : 0,
    priceSelectionMode: mode === 'Fixed' ? 'fixed' : mode === 'Dynamic' ? 'dynamic' : null,
    lines: lines.map((l) => mapLine(l, locale)),
    total,
    originOrderId: raw.originOrder?.id ?? null,
    originOrderNumber: raw.originOrder?.obj?.orderNumber ?? null,
  };
}

/** Orders with at least one recurring line and no recurring order that names them as its origin. Pure. */
export function pendingFrom(orders: Order[], subscriptions: Pick<Subscription, 'originOrderId'>[], locale: string): PendingSubscription[] {
  const known = new Set(subscriptions.map((s) => s.originOrderId).filter((id): id is string => Boolean(id)));
  return orders.flatMap((o) => {
    const recurring = o.lineItems.filter((l) => l.recurrenceInfo);
    if (recurring.length === 0 || known.has(o.id)) return [];
    return [{
      orderId: o.id,
      orderNumber: o.orderNumber ?? null,
      placedAt: o.createdAt,
      lines: recurring.map((l) => ({ name: getLocalizedString(l.name, locale), quantity: l.quantity, policyId: l.recurrenceInfo?.recurrencePolicy.id ?? '' })),
    }];
  });
}

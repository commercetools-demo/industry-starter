import 'server-only';
import type { Cart, RecurringOrder } from '@commercetools/platform-sdk';
import { getLocalizedString } from '@/lib/format';
import type { Locale, PriceSelectionMode, RecurringOrderSummary } from '@/lib/types';

/** What a mapper needs from the request: the buyer's language and the market currency. */
export interface MapContext {
  locale: Locale;
  currency: string;
}

const STATES: RecurringOrderSummary['state'][] = ['Active', 'Paused', 'Expired', 'Canceled', 'Failed'];

const isState = (value: string): value is RecurringOrderSummary['state'] => (STATES as string[]).includes(value);
const isMode = (value: string | undefined): value is PriceSelectionMode => value === 'Fixed' || value === 'Dynamic';

/** `failure` is not in the SDK types yet; read it defensively. */
function failureMessage(ro: RecurringOrder): string | undefined {
  const failure = (ro as unknown as { failure?: { message?: unknown } }).failure;
  return typeof failure?.message === 'string' ? failure.message : undefined;
}

/** SDK RecurringOrder (cart expanded) -> app summary. Never throws: a missing expanded cart gives a zero total and no lines. */
export function mapRecurringOrder(ro: RecurringOrder, ctx: MapContext): RecurringOrderSummary {
  const cart: Cart | undefined = ro.cart.obj;
  const schedule = ro.schedule;
  const cadence: RecurringOrderSummary['cadence'] =
    schedule.type === 'dayOfMonth'
      ? { dayOfMonth: schedule.day }
      : { unit: schedule.intervalUnit as 'Days' | 'Weeks' | 'Months', every: schedule.value };
  const failureReason = failureMessage(ro);
  return {
    id: ro.id,
    ...(ro.key ? { key: ro.key } : {}),
    originOrderId: ro.originOrder.id,
    state: isState(ro.recurringOrderState) ? ro.recurringOrderState : 'Failed',
    startsAt: ro.startsAt,
    ...(ro.nextOrderAt ? { nextOrderAt: ro.nextOrderAt } : {}),
    ...(ro.lastOrderAt ? { lastOrderAt: ro.lastOrderAt } : {}),
    ...(ro.expiresAt ? { expiresAt: ro.expiresAt } : {}),
    cadence,
    monthly: cart ? { centAmount: cart.totalPrice.centAmount, currencyCode: cart.totalPrice.currencyCode } : { centAmount: 0, currencyCode: ctx.currency },
    lines: (cart?.lineItems ?? []).map((li) => {
      const mode = li.recurrenceInfo?.priceSelectionMode;
      return { name: getLocalizedString(li.name, ctx.locale), sku: li.variant.sku ?? '', quantity: li.quantity, priceSelectionMode: isMode(mode) ? mode : null };
    }),
    ...(failureReason ? { failureReason } : {}),
  };
}

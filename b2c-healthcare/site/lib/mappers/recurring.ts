import type { Cart, RecurringOrder } from '@commercetools/platform-sdk';
import type { Cadence, RefillLogView, RefillView } from '@/lib/refill-types';

const nameOf = (name: Record<string, string>, locale: string): string => name[locale] ?? Object.values(name)[0] ?? '';

/** The seeded cadences by their schedule; anything else is `other`. */
export function cadenceOf(schedule: RecurringOrder['schedule'] | undefined): Cadence | 'other' {
  if (schedule?.type === 'standard' && schedule.intervalUnit === 'Months') {
    if (schedule.value === 1) return 'monthly';
    if (schedule.value === 3) return 'quarterly';
  }
  return 'other';
}

/** The recurring Cart that was expanded on the read (`expand=cart`), or null when it was not. */
export const expandedCart = (ro: Pick<RecurringOrder, 'cart'>): Cart | null => (ro.cart.obj as Cart | undefined) ?? null;

/** True when a skip was requested and not yet used up (`Counter`: `totalToSkip` > `skipped`). */
export function isSkipping(ro: Pick<RecurringOrder, 'skipConfiguration'>): boolean {
  const c = ro.skipConfiguration;
  return !!c && c.type === 'Counter' && c.totalToSkip > c.skipped;
}

/**
 * Recurring Order -> what the page shows. No price is computed: the page names the price MODE (Dynamic: looked up on
 * the day each refill is created) and never a total. Prescription numbers and signatures do not appear.
 */
export function mapRefill(ro: RecurringOrder, locale: string, lastRun: RefillLogView | null = null): RefillView {
  const cart = expandedCart(ro);
  const lines = (cart?.lineItems ?? []).map((l) => ({ name: nameOf(l.name, locale), quantity: l.quantity }));
  const mode = cart?.lineItems[0]?.recurrenceInfo?.priceSelectionMode;
  const active = ro.recurringOrderState === 'Active';
  return {
    id: ro.id,
    state: ro.recurringOrderState as RefillView['state'],
    cadence: cadenceOf(ro.schedule),
    nextOrderAt: active ? (ro.nextOrderAt ?? null) : null,
    lastOrderAt: ro.lastOrderAt ?? null,
    skipping: isSkipping(ro),
    lines,
    priceMode: mode === 'Fixed' ? 'Fixed' : 'Dynamic',
    lastRun,
  };
}

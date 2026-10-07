import { withTimeout } from '@/lib/account/with-timeout';
import { getCustomerOrdersCached, getRecurringSummariesCached } from '@/lib/ct/orders';
import { toDateOnly } from '@/lib/pricing/dates';
import type { Locale, Order, RecurringSummary } from '@/lib/types';

// What every dashboard panel reads. The orders are one read per request shared by the panels (they fail together by design); the
// recurring orders are a second, independent read. Each panel wraps its call in the panel timeout (4 s) and catches the failure itself.

export const loadOrders = (customerId: string, locale: Locale): Promise<Order[]> => withTimeout(getCustomerOrdersCached(customerId, locale));

export const loadRecurring = (customerId: string): Promise<RecurringSummary[]> => withTimeout(getRecurringSummariesCached(customerId));

/** Recurring orders for the contract: a failed read must not hide the contract, so it reads as "unknown" (`null`). */
export const loadRecurringOrNull = async (customerId: string): Promise<RecurringSummary[] | null> => {
  try {
    return await loadRecurring(customerId);
  } catch (error) {
    console.error('[account] recurring orders unavailable', error instanceof Error ? error.name : 'unknown');
    return null;
  }
};

export const todayUtc = (): string => toDateOnly(new Date());

export function logPanelFailure(panel: string, error: unknown): void {
  console.error(`[account] ${panel} unavailable`, error instanceof Error ? error.name : 'unknown');
}

/** Runs a panel's data work; a failure or timeout is logged (name only) and reads as `null`, so the panel renders "unavailable". */
export async function attempt<T>(panel: string, work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch (error) {
    logPanelFailure(panel, error);
    return null;
  }
}

import type { RecurrencePolicyView } from '@/lib/types';

/** Message key and count for a recurrence schedule ("Every 2 weeks", "Every month"). The catalogue's plural rule picks the singular. */
export function intervalMessage(schedule: RecurrencePolicyView['schedule']): { key: 'interval.days' | 'interval.weeks' | 'interval.months'; count: number } {
  const key = schedule.unit === 'Days' ? 'interval.days' : schedule.unit === 'Weeks' ? 'interval.weeks' : 'interval.months';
  return { key, count: schedule.value };
}

/**
 * Label of a recurrence schedule through a translator bound to the `pdp` namespace:
 * `formatInterval(schedule, t)` gives "Every week", "Every 2 weeks", "Every month", "Every 3 months".
 * Exported for I, K and N (cart line and subscription management).
 */
export function formatInterval(
  schedule: RecurrencePolicyView['schedule'],
  t: (key: 'interval.days' | 'interval.weeks' | 'interval.months', values: { count: number }) => string,
): string {
  const { key, count } = intervalMessage(schedule);
  return t(key, { count });
}

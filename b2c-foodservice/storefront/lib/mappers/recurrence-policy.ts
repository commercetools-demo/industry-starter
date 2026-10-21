import type { RecurrencePolicy } from '@commercetools/platform-sdk';
import type { RecurrencePolicyView } from '@/lib/types';
import { getLocalizedString } from '@/lib/utils';

/**
 * Recurrence policy to the view the product page needs. Only standard schedules (every N days, weeks or months) are
 * offered; a day-of-month schedule is skipped (null). Pure.
 */
export function mapRecurrencePolicy(p: RecurrencePolicy, locale: string): RecurrencePolicyView | null {
  if (p.schedule.type !== 'standard') return null;
  const unit = p.schedule.intervalUnit;
  if (unit !== 'Weeks' && unit !== 'Months' && unit !== 'Days') return null;
  return {
    id: p.id,
    key: p.key,
    name: p.name ? getLocalizedString(p.name, locale) : '',
    schedule: { unit: unit as 'Weeks' | 'Months' | 'Days', value: p.schedule.value },
  };
}

import { INSTALL_LEAD_DAYS } from '@/lib/config/checkout';
import { addDays } from '@/lib/pricing/dates';
import type { CartLine } from '@/lib/types';

/**
 * The service start (D-023): the order date plus the longest install lead of the plan lines (the same rule `buildOrderPricingStamp`
 * stores on the order, so what the review promises is what the order keeps). No plan line: the order date. `orderDate` is YYYY-MM-DD (UTC).
 */
export function computeServiceStart(lines: Pick<CartLine, 'kind' | 'technology'>[], orderDate: string): string {
  let lead = 0;
  for (const line of lines) {
    if (line.kind !== 'plan' || !line.technology) continue;
    lead = Math.max(lead, INSTALL_LEAD_DAYS[line.technology]);
  }
  return addDays(orderDate, lead);
}

// Minimum order value (D-063). Applied to the engine total (due today), or to one month of the recurring charge when that is more (the caller picks the amount). Set MINIMUM_ORDER_USD / MINIMUM_ORDER_EUR (cents, 0 disables). U's checkout route must enforce it with the same function.
import { minimumOrderValues } from '@/lib/config/cart';
import type { Money } from '@/lib/types';

/** `null` when the minimum is 0 (disabled) or the currency is not configured. */
export function getMinimumOrder(currency: string): Money | null {
  const cents = (minimumOrderValues() as Record<string, number | undefined>)[currency];
  return cents !== undefined && cents > 0 ? { centAmount: cents, currencyCode: currency } : null;
}

/** `required - amount` when the amount is below the minimum, else null. */
export function shortfall(total: Money, currency: string): Money | null {
  const required = getMinimumOrder(currency);
  if (!required || total.centAmount >= required.centAmount) return null;
  return { centAmount: required.centAmount - total.centAmount, currencyCode: currency };
}

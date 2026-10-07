// Minimum order value (D-063). Applied to the engine total (due today). U's checkout route must enforce it with the same function.
import { MINIMUM_ORDER_VALUE } from '@/lib/config/cart';
import type { Money } from '@/lib/types';

/** `null` when the minimum is 0 (disabled) or the currency is not configured. */
export function getMinimumOrder(currency: string): Money | null {
  const cents = (MINIMUM_ORDER_VALUE as Record<string, number | undefined>)[currency];
  return cents !== undefined && cents > 0 ? { centAmount: cents, currencyCode: currency } : null;
}

/** `required - total` when the total is below the minimum, else null. */
export function shortfall(total: Money, currency: string): Money | null {
  const required = getMinimumOrder(currency);
  if (!required || total.centAmount >= required.centAmount) return null;
  return { centAmount: required.centAmount - total.centAmount, currencyCode: currency };
}

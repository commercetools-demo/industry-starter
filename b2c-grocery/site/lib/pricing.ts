import type { Increment, Money, Price } from '@/lib/types';

export interface UnitPrice { money: Money; per: 'kg' | 'l' }

/**
 * Display-only price per kg / per litre for a weighed or measured increment (D-030).
 * `each` increments, a missing price or a non-positive increment value give `null`.
 * The discounted amount is used when present. Rounded to the nearest cent.
 */
export function unitPrice(price: Price | undefined, inc: Increment): UnitPrice | null {
  if (!price || inc.unit === 'each' || !(inc.value > 0)) return null;
  const money = price.discounted ?? price;
  const factor = inc.unit === 'g' || inc.unit === 'ml' ? 1000 / inc.value : 1 / inc.value;
  const per = inc.unit === 'g' || inc.unit === 'kg' ? 'kg' : 'l';
  return { money: { centAmount: Math.round(money.centAmount * factor), currencyCode: money.currencyCode }, per };
}

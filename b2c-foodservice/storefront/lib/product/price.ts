import type { Money, VariantPrice } from '@/lib/types';

/**
 * Unit price the shopper pays at a quantity (workstream H, 3.6). Exported for I, K and O.
 * A discounted price wins and ignores volume tiers (a Product Discount disables volume pricing); otherwise the tier with
 * the greatest `minimumQuantity <= quantity` applies; otherwise the list price. Integer minor units throughout.
 */
export function effectiveUnitPrice(price: VariantPrice, quantity: number): Money {
  if (price.discounted) return price.discounted;
  let best: { minimumQuantity: number; value: Money } | undefined;
  for (const tier of price.tiers) {
    if (tier.minimumQuantity <= quantity && (!best || tier.minimumQuantity > best.minimumQuantity)) best = tier;
  }
  return best ? best.value : price.value;
}

/** Unit price times quantity, minor units. */
export function lineTotal(price: VariantPrice, quantity: number): Money {
  const unit = effectiveUnitPrice(price, quantity);
  return { centAmount: unit.centAmount * quantity, currencyCode: unit.currencyCode };
}

/** Total of a recurring price (one recurring unit price times quantity). */
export function recurringTotal(unit: Money, quantity: number): Money {
  return { centAmount: unit.centAmount * quantity, currencyCode: unit.currencyCode };
}

/** Saving of a recurring price against the one-time price as a whole percent; undefined unless positive (Q-H-07). */
export function savingPercent(oneTime: Money, recurring: Money): number | undefined {
  if (!(oneTime.centAmount > 0)) return undefined;
  const pct = Math.round((1 - recurring.centAmount / oneTime.centAmount) * 100);
  return pct > 0 ? pct : undefined;
}

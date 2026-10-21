import type { Money } from '@/lib/types';

/**
 * Per-unit price where the pack size matters: pods per capsule (price / capsules per pack), coffee per 100 g.
 * Minor units, rounded to the nearest cent. Other products have none.
 */
export function unitPrice(
  price: Money,
  attrs: { capsulesPerPack?: number; sizeGrams?: number },
): { money: Money; perKey: 'capsule' | '100g' } | undefined {
  if (attrs.capsulesPerPack && attrs.capsulesPerPack > 0) {
    return { money: { centAmount: Math.round(price.centAmount / attrs.capsulesPerPack), currencyCode: price.currencyCode }, perKey: 'capsule' };
  }
  if (attrs.sizeGrams && attrs.sizeGrams > 0) {
    return { money: { centAmount: Math.round((price.centAmount / attrs.sizeGrams) * 100), currencyCode: price.currencyCode }, perKey: '100g' };
  }
  return undefined;
}

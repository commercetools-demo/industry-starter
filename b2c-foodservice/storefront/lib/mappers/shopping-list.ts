import type { ShoppingList, ShoppingListLineItem } from '@commercetools/platform-sdk';
import { getLocalizedString } from '@/lib/utils';
import type { ProductSummary, SavedItem, SavedList } from '@/lib/types';

/** Newest first. The line carries no price: the card comes from the product read (price in the shopper's market). */
export function toSavedItem(line: ShoppingListLineItem, locale: string, product: ProductSummary | null): SavedItem {
  return {
    productId: line.productId,
    variantId: line.variantId ?? null,
    lineItemId: line.id,
    addedAt: line.addedAt,
    name: getLocalizedString(line.name as Record<string, string>, locale),
    product,
  };
}

export function toSavedList(list: ShoppingList, locale: string, products: Map<string, ProductSummary> = new Map()): SavedList {
  const items = [...list.lineItems]
    .sort((a, b) => (a.addedAt < b.addedAt ? 1 : a.addedAt > b.addedAt ? -1 : 0))
    .map((l) => toSavedItem(l, locale, products.get(l.productId) ?? null));
  return { id: list.id, version: list.version, items };
}

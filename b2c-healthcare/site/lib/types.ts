/**
 * App types: the only shapes components, hooks and context may import.
 * Skeleton only; each workstream adds its own types here. SDK types are never re-exported:
 * lib/mappers/ converts them before they leave lib/ct/.
 */

/** commercetools localized string: locale key -> text. Render with getLocalizedString(field, locale). */
export type LocalizedString = Record<string, string>;

/** Money as the platform sends it. Render with formatMoney(centAmount, currencyCode, locale). */
export interface Money {
  centAmount: number;
  currencyCode: string;
  fractionDigits: number;
}

/** A catalog category with its children nested (public, identical for every visitor). */
export interface Category {
  id: string;
  key: string;
  name: LocalizedString;
  slug: LocalizedString;
  parentId: string | null;
  orderHint: string;
  children: Category[];
}

/** One shipping rate of a method, per zone (public data). */
export interface ShippingRateInfo {
  zoneId: string;
  price: Money;
  freeAbove: Money | null;
}

/** An active shipping method as shown before a cart exists. */
export interface ShippingMethodInfo {
  id: string;
  key: string;
  name: string;
  description: LocalizedString;
  isDefault: boolean;
  rates: ShippingRateInfo[];
}

/** Body of every non-2xx BFF response (see lib/api.ts). */
export interface ApiErrorBody {
  error: string;
}

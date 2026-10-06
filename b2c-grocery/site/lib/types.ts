/** App types. No SDK imports here: components import only this file (see lib/mappers for the SDK boundary). */
export interface Money { centAmount: number; currencyCode: string }
export interface Price { centAmount: number; currencyCode: string; discounted?: Money }
export type IncrementUnit = 'g' | 'kg' | 'ml' | 'l' | 'each';
/** `label` is the localized packLabel, e.g. "500 g". */
export interface Increment { value: number; unit: IncrementUnit; label: string }
export interface Availability { isOnStock: boolean; availableQuantity: number }
export interface Variant {
  id: number;
  sku: string;
  images: string[];
  price?: Price;
  attributes: Record<string, string | number | boolean | string[]>;
  increment: Increment;
  approximateWeight: boolean;
  availability: Availability;
}
/** `variants[0]` is the master/default variant. */
export interface Product {
  type: 'Product';
  id: string;
  key?: string;
  name: string;
  slug: string;
  description: string;
  brand?: string;
  origin?: string;
  storage?: 'ambient' | 'chilled' | 'frozen';
  dietary: string[];
  allergens: string[];
  recurringEligible: boolean;
  categoryIds: string[];
  substituteProductIds: string[];
  variants: Variant[];
}
export interface Category { id: string; key: string; name: string; slug: string; parentId?: string; children?: Category[] }
export interface ListingFacets {
  categories: { id: string; count: number }[];
  priceBands: { id: string; count: number }[];
  availability: { inStock: number; outOfStock: number };
}
export interface SearchResult { products: Product[]; total: number; page: number; pageSize: number; facets: ListingFacets }
export type SortKey = 'relevance' | 'newest' | 'price-asc' | 'price-desc';

export interface Address {
  firstName?: string;
  lastName?: string;
  streetName?: string;
  additionalStreetInfo?: string;
  postalCode?: string;
  city?: string;
  country: string;
  phone?: string;
  email?: string;
}
export type SubstitutionPreference = 'allow-similar' | 'none';
export interface CartLine {
  id: string;
  productId: string;
  sku: string;
  name: string;
  slug: string;
  image?: string;
  quantity: number;
  unitPrice: Price;
  total: Money;
  increment: Increment;
  approximateWeight: boolean;
  substitutionPreference: SubstitutionPreference;
  recurrence?: { policyKey: string; priceSelectionMode: 'Fixed' | 'Dynamic' };
  availableQuantity?: number;
  inStock: boolean;
}
export interface CartSlot { id: string; start: string; end: string; charge?: Money; holdExpires?: string }
export interface Cart {
  id: string;
  version: number;
  currencyCode: string;
  lines: CartLine[];
  /** Distinct lines, not units. */
  itemCount: number;
  subtotal: Money;
  shipping?: { name?: string; price: Money; free: boolean };
  tax?: Money;
  total: Money;
  isProvisional: boolean;
  shippingAddress?: Address;
  slot?: CartSlot;
}

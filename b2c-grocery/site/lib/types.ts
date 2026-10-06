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
/** Static placeholder data (D-039): never populated in v1, so the PDP reviews block stays hidden. `distribution[i]` counts (i + 1)-star reviews. */
export interface ProductReviews {
  average: number;
  count: number;
  distribution: number[];
  items: { id: string; author: string; rating: number; meta?: string; title: string; body: string }[];
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
  reviews?: ProductReviews;
}
export interface Category { id: string; key: string; name: string; slug: string; parentId?: string; children?: Category[] }
export interface ListingFacets {
  categories: { id: string; count: number }[];
  priceBands: { id: string; count: number }[];
  availability: { inStock: number; outOfStock: number };
}
export interface SearchResult { products: Product[]; total: number; page: number; pageSize: number; facets: ListingFacets }
export type SortKey = 'relevance' | 'newest' | 'price-asc' | 'price-desc';

/** The signed-in shopper as exposed to client code (from the session cookie, never a full commercetools customer). */
export interface AccountUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

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
/** An address in the customer's address book (S): the commercetools id and the default flags are always present. */
export interface SavedAddress extends Address {
  id: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
  key?: string;
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

/** `GET /api/account/profile`. */
export interface AccountProfile {
  createdAt: string;
  firstName: string;
  lastName: string;
  email: string;
  defaultShippingAddress?: Address;
}

export type OrderStatus = 'processing' | 'packing' | 'on-its-way' | 'delivered' | 'cancelled' | 'unknown';
export interface OrderLine {
  id: string;
  name: string;
  sku: string;
  image?: string;
  quantity: number;
  unitPrice: Price;
  total: Money;
  increment: Increment;
  approximateWeight: boolean;
  substitutionPreference: SubstitutionPreference;
  substitute?: { sku: string; name: string };
}
export interface Order {
  id: string;
  orderNumber?: string;
  createdAt: string;
  status: OrderStatus;
  statusRaw: string;
  lines: OrderLine[];
  subtotal: Money;
  shipping?: Money;
  tax?: Money;
  total: Money;
  isProvisional: boolean;
  /** Amount recorded after weighing (order custom field `finalTotal`, type `order-final`). */
  finalTotal?: Money;
  shippingAddress?: Address;
  slot?: CartSlot;
  inventoryMode: string;
  version: number;
  customerId?: string;
}
export interface OrderListItem {
  id: string;
  orderNumber?: string;
  createdAt: string;
  status: OrderStatus;
  total: Money;
  /** "Whole milk, Bananas +2" */
  itemSummary: string;
}

/** A pending substitution proposal (Order Edit of custom type `substitution-proposal`) on an order. */
export interface Proposal {
  editId: string;
  originalLineItemId: string;
  originalName: string;
  substituteSku: string;
  substituteName: string;
  /** New order total minus current order total (from the Order Edit preview). */
  priceDifference: Money;
  newTotal?: Money;
  note?: string;
  /** Accept and Decline are only offered when true (order editable and the preview succeeded). */
  editable: boolean;
}

/** `GET /api/account/orders/[orderId]/proposals`. `removalRequested` are original line item ids of declined proposals. */
export interface ProposalsResponse {
  proposals: Proposal[];
  removalRequested: string[];
}

/** A recurring order (subscription) of the signed-in customer (workstream W). `Other` covers Expired and Failed (`stateRaw` has the real value). */
export interface RecurringOrderSummary {
  id: string;
  state: 'Active' | 'Paused' | 'Canceled' | 'Other';
  stateRaw: string;
  /** Localized policy name such as "Every 2 weeks". */
  cadenceLabel: string;
  /** Key of the recurrence policy the lines use, when known. */
  policyKey?: string;
  lines: { id: string; sku: string; name: string; quantity: number; image?: string }[];
  /** ISO date of the next generated order; absent when paused or canceled. */
  nextOrderAt?: string;
  /** ISO date of the last order: the last generated one, else the original order. */
  lastOrderAt?: string;
}

/** `GET /api/account/recurring`. */
export interface RecurringOrdersResponse {
  recurringOrders: RecurringOrderSummary[];
  /** Cadences the customer can switch to (localized). */
  policies: { key: string; name: string }[];
}

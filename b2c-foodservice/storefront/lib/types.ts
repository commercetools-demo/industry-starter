import type { ErrorCode } from '@/lib/errors';

export type LocaleKey = 'en-US' | 'en-CA';

export interface Money { centAmount: number; currencyCode: string }
/** discounted = the price to pay when present; discountName only when the discount was expanded. */
export interface Price { value: Money; discounted?: Money; discountName?: string }
export interface ImageRef { url: string; width?: number; height?: number; alt?: string }

export type AttributeValue =
  | string | number | boolean
  | { key: string; label: string }
  | Array<string | number | boolean | { key: string; label: string }>;

export interface Variant {
  id: number; sku: string;
  images: ImageRef[];
  price?: Price;
  attributes: Record<string, AttributeValue>;
  availability?: { isOnStock: boolean; availableQuantity?: number };
}

export interface RatingStats {
  average: number;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface Product {
  id: string; key?: string; slug: string; name: string; description?: string;
  productTypeKey?: string;
  categoryIds: string[];
  masterVariant: Variant; variants: Variant[];
  attributes: Record<string, AttributeValue>;
  rating?: RatingStats;
}

export interface Category {
  id: string; key?: string; name: string; slug: string; description?: string;
  imageUrl?: string; parentId?: string; orderHint?: string; children: Category[];
}

export type ApiErrorBody = { error: { code: ErrorCode; message: string } };

// Workstream F: shell, stores, availability, promise figures, markets.
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
/** 'HH:mm' in the store time zone; null means closed that day. */
export type OpeningHours = Record<Weekday, { open: string; close: string } | null>;
export interface Store {
  /** Channel id and key (for example mcf-store-nyc-soho). */
  id: string; key: string;
  name: string;
  addressLine: string; city: string; postalCode: string; country: string;
  phone?: string; hours: OpeningHours; timeZone: string;
  collectionMinutes: number;
  geo?: { lat: number; lng: number };
}
export type AvailabilityState = 'in' | 'low' | 'out';
export interface StoreAvailability { storeKey: string; state: AvailabilityState; quantity: number }
export interface SkuAvailability { sku: string; ship: AvailabilityState; stores: StoreAvailability[] }
export interface PromiseFigures {
  freeShippingThreshold: Money | null; collectionMinutes: number | null; returnDays: number;
}
export interface MarketOption {
  country: string; currency: string; locale: string; label: string;
  languages: { locale: string; label: string }[];
  region: 'North America';
}

// Workstream J: auth and session.
export type RuleId = 'min_length' | 'max_length' | 'letter' | 'digit' | 'not_email';
export interface AppAddress {
  id: string; label: string | null;
  firstName: string; lastName: string;
  streetName: string; additionalStreetInfo: string | null;
  city: string; state: string | null; postalCode: string; country: string;
  phone: string | null;
  isDefaultShipping: boolean; isDefaultBilling: boolean;
}
export interface AppCustomer {
  id: string; email: string; firstName: string; lastName: string;
  defaultShippingAddressId: string | null;
  addresses: AppAddress[];
}
/** The cart as the auth routes report it after a sign-in merge (workstream I owns the full cart view). */
export interface AuthCart { id: string; lineCount: number; quantity: number }

// Workstream G: browse. Card, listing and cart core types.
export type CardBadge = 'bestseller' | 'limited-edition' | 'new' | 'subscribe';
export interface ProductSummary {
  id: string; slug: string;
  /** SKU of the default variant (cheapest in the market, tie: master). */
  sku: string;
  name: string; categoryName: string;
  imageUrl?: string; imageAlt: string;
  badge: CardBadge | null;
  /** null: no price in this market. `from` is the amount to pay; `old` the struck-through one. */
  price: { from: Money; fromIsRange: boolean; old?: Money; discountName?: string } | null;
  unit?: { money: Money; perKey: 'capsule' | '100g' };
  label?: { kind: 'intensity' | 'roast'; value: string };
  swatches?: { key: string; name: string }[];
  requiredChoice: 'grind' | 'colour' | null;
  rating: { average: number; count: number } | null;
  /** null when no store is chosen (or the market has no stores). */
  availability: { state: AvailabilityState } | null;
  matchedSku?: string;
}

export interface FacetOption {
  value: string; label: string; count: number; selected: boolean;
  /** Colour enum key (colour facet only). */
  colour?: string;
  /** Listing URL (path without the locale, with query) that toggles this option; set by the server. */
  href?: string;
}
export interface FacetGroup {
  name: string; label: string; control: 'checkbox' | 'radio' | 'colour' | 'grid';
  options: FacetOption[]; selectedCount: number;
}

export interface CartLineSummary { id: string; sku: string; quantity: number }
/** Minimal cart for the quick add path. Workstream I replaces it with the full cart type but keeps these fields. */
export interface CartSummary { id: string; version: number; count: number; lines: CartLineSummary[] }

// Workstream H: product detail view model (see lib/mappers/product-detail.ts).
export type ProductShape = 'pods' | 'coffee' | 'machine' | 'accessory' | 'gift';
export type VariantAttrValue = string | number | boolean;
export interface PriceTier { minimumQuantity: number; value: Money }
export interface VariantPrice { value: Money; discounted?: Money; discountName?: string; tiers: PriceTier[] }
export interface VariantStock {
  /** Online warehouse (the entry without a supply channel). */
  online: number;
  restockableInDays?: number;
  expectedDelivery?: string;
  minQty?: number;
  maxQty?: number;
  /** Quantity per store channel id. */
  stores: Record<string, number>;
}
/** Inventory read for one SKU (lib/ct/inventory.ts#getInventoryDetail). */
export type InventoryDetail = VariantStock;
export interface VariantView {
  sku: string; id: number;
  /** Enum key, number or boolean values only (sets are facts, not variant attributes). */
  attrs: Record<string, VariantAttrValue>;
  attrLabels: Record<string, string>;
  /** null: no selected price, or the amount is 0. */
  price: VariantPrice | null;
  /** Recurrence prices of the shopper's currency and country. */
  recurring: { policyId: string; value: Money }[];
  images: ImageRef[];
  stock: VariantStock;
  unit?: { money: Money; perKey: 'capsule' | '100g' };
}
export type SelectorRenderer = 'pill' | 'colour';
export interface SelectorDef {
  attr: string;
  renderer: SelectorRenderer;
  required: boolean;
  options: { value: string; label: string }[];
}
export interface ProductDetail {
  id: string; slug: string; name: string; categoryName: string;
  breadcrumb: { id: string; name: string; slug: string }[];
  tagline: string; description?: string;
  shape: ProductShape;
  badge: CardBadge | null;
  subscribable: boolean;
  rating: RatingStats | null;
  variants: VariantView[];
  defaultSku: string;
  selectors: SelectorDef[];
  facts: {
    intensity?: number; roast?: string; roastKey?: string; origin?: string; notes: string[];
    /** Specification rows; the page maps `key` to `pdp.spec.<key>`. */
    specs: { key: string; value: string }[];
  };
  systemKey?: string;
  metaTitle?: string; metaDescription?: string;
}
export interface RecurrencePolicyView {
  id: string; key: string; name: string;
  schedule: { unit: 'Weeks' | 'Months' | 'Days'; value: number };
}

/** What the product page needs for one SKU and locale (built by lib/pdp/load.ts). Plain data, safe to pass to client components. */
export interface ProductPageData {
  product: ProductDetail;
  /** Category slugs of the two pod systems, for the compatibility guide links. */
  guideLinks: { original?: string; vertuo?: string };
  /** Recurrence policies (empty when the product is not subscribable or the read failed: the Subscribe card is hidden). */
  policies: RecurrencePolicyView[];
  /** The inventory read failed: the page says stock could not be checked and disables the add button. */
  inventoryFailed: boolean;
  freeShippingThreshold: Money | null;
  returnDays: number;
  /** Collection in store is offered in this market (US only, D-035). */
  collection: boolean;
  country: string;
  currency: string;
}

// Workstream M: reviews and ratings (no moderation, D-037: every review is published on creation).
export type ReviewSort = 'newest' | 'highest' | 'lowest';
export interface ReviewView {
  id: string; rating: 1 | 2 | 3 | 4 | 5; title: string | null; text: string | null; authorName: string;
  createdAt: string; locale: string | null; verifiedPurchase: boolean;
}
export interface MyReviewView extends ReviewView {
  version: number;
  product: { id: string; name: string; slug: string; sku: string | null; imageUrl: string | null } | null;
}
export interface ReviewPage { reviews: ReviewView[]; total: number; page: number; pageSize: 5; hasMore: boolean }
/** GET /api/reviews?productId=... answer: the page plus the signed-in customer's own review id for this product. */
export interface ReviewPageResponse extends ReviewPage { mine: { id: string } | null }
export interface ReviewInput { rating: number; title?: string; text?: string }

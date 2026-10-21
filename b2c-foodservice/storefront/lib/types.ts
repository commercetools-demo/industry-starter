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

export interface FacetOption { value: string; label: string; count: number; selected: boolean; colour?: string }
export interface FacetGroup {
  name: string; control: 'checkbox' | 'radio' | 'colour' | 'grid';
  options: FacetOption[]; selectedCount: number;
}

export interface CartLineSummary { id: string; sku: string; quantity: number }
/** Minimal cart for the quick add path. Workstream I replaces it with the full cart type but keeps these fields. */
export interface CartSummary { id: string; version: number; count: number; lines: CartLineSummary[] }

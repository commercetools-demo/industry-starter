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

// Workstream I: the full cart view (what the drawer, the cart page and checkout read). `Cart` keeps every field of `CartSummary`.
export type Fulfilment = 'collect' | 'delivery' | 'subscribe';
/** `collect:<storeKey>`, `delivery` or `subscribe`. The only definition of a fulfilment group is `groupKeyOf` (lib/cart/plan.ts). */
export type GroupKey = `collect:${string}` | 'delivery' | 'subscribe';
export type LineNoticeKind = 'price-updated' | 'out-of-stock' | 'collect-unavailable' | 'quantity-exceeds-stock';
export interface LineNotice {
  kind: LineNoticeKind;
  /** price-updated: the unit price before the change. */
  previous?: Money;
  /** quantity-exceeds-stock: how many can be bought. */
  available?: number;
}
export interface CartLineStore {
  key: string; id: string; name: string; addressLine: string; city: string; collectionMinutes: number;
}
export interface CartLine {
  id: string; sku: string; productId: string; slug: string; name: string;
  imageUrl?: string; imageAlt: string;
  /** "Intensity 8 · 10 capsules", "250 g · Whole bean". */
  variantSummary: string;
  quantity: number;
  unitPrice: Money; oldUnitPrice?: Money;
  /** The engine's line total, verbatim. */
  total: Money;
  fulfilment: Fulfilment;
  groupKey: GroupKey;
  store?: CartLineStore;
  recurrence?: { policyId: string; schedule: { unit: 'Weeks' | 'Months' | 'Days'; value: number } };
  /** For ship lines: stock at the session's chosen store, to enable the Collect chip. */
  collectAtSessionStore?: { storeKey: string; storeName: string; state: AvailabilityState } | null;
  notices: LineNotice[];
  maxQuantity: number;
  /** Product shape ('pods', 'machine', ...) and capsule system, for the companion nudge. */
  shape?: ProductShape;
  systemKey?: string;
}
export interface CartGroup { key: GroupKey; kind: Fulfilment; store?: CartLineStore; lineIds: string[] }
export type CodeState =
  | 'MatchesCart' | 'NotActive' | 'DoesNotMatchCart' | 'MaxApplicationReached' | 'ApplicationStoppedByPreviousDiscount' | 'NotValid';
export interface AppliedCode { id: string; code: string; name?: string; state: CodeState; reasonKey?: string }
export type CartBlocker = 'empty' | 'below-minimum' | 'out-of-stock' | 'collect-unavailable' | 'price-unavailable';
export interface CartNudge { sku: string; name: string; price: Money; machineName: string }
export interface Cart {
  id: string; version: number; currency: string; country: string; shippingMode: 'Single' | 'Multiple';
  /** Units (totalLineItemQuantity). */
  count: number;
  lines: CartLine[]; groups: CartGroup[];
  /** Display sum of the engine's line totals (not a decision input). */
  subtotal: Money;
  /** Positive amount saved (display sum), null when none. */
  discount: Money | null;
  shipping: { amount: Money; isFree: boolean } | null;
  tax: { amount: Money; included: boolean } | null;
  /** The engine total (taxedPrice.totalGross when present, else totalPrice). */
  total: Money;
  codes: AppliedCode[];
  freeShipping: { threshold: Money | null; remaining: Money | null; reached: boolean };
  minimumOrder: { value: Money | null; shortfall: Money | null };
  canCheckout: boolean; blockers: CartBlocker[];
  nudge: CartNudge | null;
}
export interface DroppedLine { sku: string; name: string; reason: 'no-price' | 'unknown' }

// Workstream K: checkout and confirmation. The Review stage reads the cart view (`Cart`, workstream I) and adds what checkout needs.
export type MixedStrategy = 'complete-multiple' | 'complete-per-group' | 'payment-only-for-collect';
export type CheckoutStage = 'review' | 'pay';
export type CheckoutIssueCode = 'line_unavailable' | 'collect_out_of_stock' | 'collect_not_available' | 'price_changed' | 'currency_mismatch';
export interface CheckoutIssue { code: CheckoutIssueCode; lineId: string }
export type DiscountCodeState = 'applied' | 'not_applicable' | 'pending';
export interface DiscountCodeView { code: string; label: string | null; state: DiscountCodeState; reason: string | null; savingCents: number | null }
export interface SummaryView {
  currency: string;
  /** Before cart-level discounts. */
  subtotalCents: number; discountCents: number;
  /** null: no shipping method yet ("Calculated in secure checkout"). */
  shippingCents: number | null; shippingFree: boolean;
  /** null: the engine has no taxed price yet. */
  taxCents: number | null; totalCents: number; version: number;
}
export interface CheckoutPickup {
  storeKey: string; storeName: string; address: string; hoursToday: string | null; phone: string | null;
  readyMinutes: number | null; pickupName: string | null;
}
/** One payment: one fulfilment cluster (complete-per-group pays each collect store, then delivery plus subscription). */
export interface CheckoutPayment { part: number; clusterKey: GroupKey; label: string | null; totalCents: number }
export interface CheckoutState {
  cartId: string; version: number;
  strategy: MixedStrategy;
  /** The bag as the cart page shows it: every line carries its `groupKey`; the UI renders lines only inside their cluster. */
  cart: Cart;
  pickup: CheckoutPickup | null;
  deliveryNote: { freeAboveCents: number | null; days: string | null } | null;
  codes: DiscountCodeView[];
  summary: SummaryView;
  issues: CheckoutIssue[];
  /** Set once the pay stage is prepared (pickup saved): the payments to make, in order. */
  payments: CheckoutPayment[] | null;
}
export type OrderState = 'ordered' | 'preparing' | 'ready-for-collection' | 'collected';
export interface OrderLineView {
  id: string; name: string; variantSummary: string; quantity: number; imageUrl: string | null;
  fulfilment: Fulfilment; storeKey: string | null; recurrence: RecurrencePolicyView['schedule'] | null; priceCents: number;
}
export interface OrderDelivery { id: string; trackingId: string | null; trackingUrl: string | null; carrier: string | null }
export interface OrderView {
  id: string; orderNumber: string; createdAt: string; email: string | null; locale: string; currency: string; customerId: string | null;
  state: OrderState | null; paymentState: string | null; shipmentState: string | null;
  lines: OrderLineView[];
  collect: { storeKey: string; storeName: string; address: string; hours: string | null; phone: string | null; readyMinutes: number | null; pickupName: string | null }[];
  ship: { methodName: string; estimate: string | null; address: string; deliveries: OrderDelivery[] } | null;
  subscriptions: { lineId: string; schedule: RecurrencePolicyView['schedule'] }[];
  totals: { subtotalCents: number; discountCents: number; shippingCents: number; taxCents: number; totalCents: number };
  /** Other orders of the same purchase (complete-per-group), by the shared base number. */
  linked: { id: string; orderNumber: string }[];
}

// Workstream L: account area. `OrderDetailView` stands alone until K's `OrderView` lands (Q-L-16).
export type OrderStatusKind = 'ordered' | 'preparing' | 'ready' | 'shipped' | 'completed' | 'cancelled';
/** Keys of the seeded `mcf-order-*` states without the prefix. */
export type OrderStateKey = 'ordered' | 'preparing' | 'ready-for-collection' | 'collected';
export type OrderFilter = 'all' | 'in-progress' | 'ready' | 'completed';
export interface OrderCollectInfo { storeName: string; hours: string | null; lat: number | null; lng: number | null }
export interface OrderListItem {
  id: string; orderNumber: string; createdAt: string; totalCents: number; currency: string;
  status: OrderStatusKind; hasCollect: boolean; hasShip: boolean;
  thumbs: { imageUrl: string | null; name: string }[]; itemCount: number;
  collect: OrderCollectInfo | null;
}
export interface OrderLineView {
  id: string; sku: string; name: string; imageUrl: string | null; quantity: number;
  unitCents: number; totalCents: number; fulfilment: Fulfilment; storeName: string | null;
}
export type ReturnShipmentState = 'Advised' | 'Returned' | 'BackInStock' | 'Unusable';
export type ReturnPaymentState = 'NonRefundable' | 'Initial' | 'Refunded' | 'NotRefunded';
export interface OrderDelivery {
  id: string; createdAt: string; carrier: string | null; trackingId: string | null; trackingUrl: string | null;
  items: { lineId: string; name: string; quantity: number }[];
}
export interface OrderReturnItem {
  id: string; lineId: string; name: string; quantity: number; reason: string | null;
  shipmentState: ReturnShipmentState; paymentState: ReturnPaymentState;
}
export interface OrderReturn { id: string; createdAt: string; trackingId: string | null; items: OrderReturnItem[] }
export interface OrderDetailView {
  id: string; orderNumber: string; createdAt: string; currency: string; status: OrderStatusKind;
  stateKey: OrderStateKey | null; shipmentState: string | null; paymentState: string | null;
  hasCollect: boolean; hasShip: boolean;
  lines: OrderLineView[];
  subtotalCents: number; shippingCents: number | null; taxCents: number | null; totalCents: number;
  collect: (OrderCollectInfo & { addressLine: string | null; phone: string | null }) | null;
  shippingAddress: { name: string; line: string; city: string; state: string | null; postalCode: string; country: string } | null;
  deliveries: OrderDelivery[];
  returns: OrderReturn[];
  canReturn: boolean; returnWindowEndsAt: string | null;
  /** Units of each line that can still be returned (line id to quantity). */
  returnable: Record<string, number>;
}
export interface AccountSummary { openOrders: number | null; readyForCollection: number | null; savedItems: number | null }
export type ReorderSkipReason = 'unavailable' | 'out_of_stock' | 'not_found' | 'price_missing';
export interface ReorderResult {
  added: { sku: string; name: string; quantity: number; fulfilment: Fulfilment }[];
  skipped: { sku: string; name: string; reason: ReorderSkipReason }[];
  cart: CartSummary;
}
/** `product` is the card (price in the shopper's market) or null when the product is gone or unpublished; `name` is the list's own copy. */
export interface SavedItem { productId: string; variantId: number | null; lineItemId: string; addedAt: string; name: string; product: ProductSummary | null }
export interface SavedSkipped { productId: string; name: string; reason: ReorderSkipReason }
export interface SavedAddAllResult { added: ReorderResult['added']; skipped: SavedSkipped[]; cart: CartSummary }
export interface SavedList { id: string; version: number; items: SavedItem[] }
export interface AddressInput {
  label?: string; firstName: string; lastName: string; streetName: string; additionalStreetInfo?: string;
  city: string; state?: string; postalCode: string; country: string; phone?: string;
}
export interface AccountProfile {
  firstName: string; lastName: string; email: string; phone: string | null; defaultShippingAddressId: string | null;
}
export interface PaymentMethodView { id: string; version: number; label: string; method: string; isDefault: boolean }

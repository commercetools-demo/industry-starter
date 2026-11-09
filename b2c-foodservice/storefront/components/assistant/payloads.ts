/**
 * The ENRICHED payloads the six cards receive (workstream T). They are the snake_case JSON lib/agent/shopping/enrichment.ts builds:
 * absent fields are OMITTED, never null. This file mirrors that wire format on purpose and imports nothing from lib/agent (server only).
 * Money: `price` and `total` fields here are MAJOR units (format with `useAgentMoney`); `CheckoutTotals` is MINOR units (`useCentMoney`).
 */

/** `cardProduct` in lib/agent/shopping/card-serialization.ts. `options` is present (maybe empty) on every record; non-empty means a family. */
export interface CardProduct {
  product_id: string;
  title: string;
  brand?: string;
  /** Major units; a family's price is its lowest variant's. */
  price: number;
  currency: string;
  rating?: number;
  review_count?: number;
  image_url?: string;
  category?: string;
  labels?: string[];
  attributes?: Record<string, string>;
  in_stock?: boolean;
  short_description?: string;
  /** option name to the values the family offers. */
  options?: Record<string, string[]>;
  /** what a variant chose: option name to value. */
  option_values?: Record<string, string>;
  variant_of?: string;
}

export interface ProductsPayload {
  title?: string;
  layout?: 'carousel' | 'grid' | 'list';
  items: { product: CardProduct; reason?: string }[];
}

export interface ComparisonEntry {
  product_id: string;
  pros?: string[];
  cons?: string[];
  best_for?: string;
  product: CardProduct;
}

export interface ComparisonPayload {
  title?: string;
  entries: ComparisonEntry[];
  dimensions?: string[];
  recommended_product_id?: string;
  /** Present only when at least two entries are priced in one currency and the spread is non-zero. Major units. */
  price_delta?: { amount: number; low_product_id: string; low_price: number; high_product_id: string; high_price: number };
}

export interface PlanStep {
  label: string;
  detail?: string;
  products: CardProduct[];
}

export interface PlanPayload {
  title: string;
  intro?: string;
  steps: PlanStep[];
}

export interface GuideSection {
  heading: string;
  body: string;
}

export interface GuidePayload {
  title: string;
  sections: GuideSection[];
  sources?: string[];
  related_products?: CardProduct[];
}

export type OrderStatusWord =
  'processing' | 'shipped' | 'out_for_delivery' | 'delivered' | 'delayed' | 'cancelled' | 'return_initiated' | 'refunded';

export interface CardOrderItem {
  product_id: string;
  title: string;
  quantity: number;
  /** Unit price, major units. */
  price: number;
  option_values?: Record<string, string>;
  variant_of?: string;
}

export interface CardOrder {
  order_id: string;
  status?: OrderStatusWord;
  /** As the server sent it (ISO 8601 when the platform says); rendered verbatim. */
  placed_at?: string;
  items: CardOrderItem[];
  /** Major units. */
  total: number;
  currency: string;
  estimated_delivery?: string;
  tracking_url?: string;
  view_url?: string;
}

export interface OrderStatusPayload {
  order_id: string;
  summary: string;
  next_step?: string;
  order: CardOrder;
}

/** `cardTotals`: MINOR units as the platform sent them. `discount_minor` is present only when non-zero. */
export interface CheckoutTotals {
  currency: string;
  subtotal_minor?: number;
  discount_minor?: number;
  total_minor: number;
}

export interface CheckoutLine {
  product_id: string;
  title: string;
  /** Unit price, major units. */
  price: number;
  quantity: number;
  image_url?: string;
  option_values?: Record<string, string>;
  variant_of?: string;
}

export interface CheckoutPayload {
  note?: string;
  fulfillment_method?: 'delivery' | 'pickup' | 'shipping';
  /** The model-facing cart summary; the card renders `lines` and `totals` instead. */
  cart?: { currency: string; item_count?: number; subtotal?: number };
  /** Absent when the platform sent no totals. */
  totals?: CheckoutTotals;
  lines: CheckoutLine[];
  handoffs?: { url: string; label?: string; seller?: string }[];
}

/** What `GET /api/assistant/card/product` returns for the detail panel. */
export interface CardProductDetail {
  product: CardProduct;
  variants: CardProduct[];
}

// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from shopping-agent/core/shopping_agent/types.py; changes: TypeScript interfaces; absent optional fields are omitted (never null); camelCase names; session context gains principal fields and an AbortSignal; provenance is a Map.

import { type ClockContext, remember } from '../common/types';

/**
 * One catalogue record, in one of three shapes. Plain: bought as is. Family: carries `options` (each option with its values in display
 * order) for something sold as a fixed set of separately stocked and priced variants. Search returns it and the cart refuses it; its
 * `price` is its lowest in-stock variant's and `inStock` is true while any variant is. Variant: returned in its family's
 * `ProductDetails.variants` with its own id, price and stock, `optionValues` (one value per option) and the family's id in `variantOf`;
 * the cart takes its id like any product's.
 *
 * Money is a float in MAJOR units (`349` is 349 dollars). The only module that converts from the storefront's integer minor units is
 * `lib/agent/shopping/money.ts`. A figure the platform cannot supply is ABSENT, never `0`.
 */
export interface Product {
  productId: string;
  title: string;
  brand?: string;
  price: number;
  currency: string;
  /** 0 to 5; absent when the platform has no rating (a 0 would render as one star). */
  rating?: number;
  reviewCount?: number;
  imageUrl?: string;
  category?: string;
  labels: string[];
  attributes: Record<string, string>;
  inStock: boolean;
  shortDescription?: string;
  options: Record<string, string[]>;
  optionValues: Record<string, string>;
  variantOf?: string;
}

/** True for a family: the cart takes one of its variants. */
export function hasOptions(product: Pick<Product, 'options'>): boolean {
  return Object.keys(product.options).length > 0;
}

export interface ProductDetails extends Product {
  longDescription?: string;
  specs: Record<string, string>;
  reviewHighlights: string[];
  variants: Product[];
}

export interface SearchFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  attributes: Record<string, string>;
  sort: 'relevance' | 'price_asc' | 'price_desc' | 'rating';
}

/** `quantity` counts whole units of the record as sold. */
export interface CartItem {
  productId: string;
  title: string;
  /** The line's effective unit price: `lineTotal / quantity` (so the derived `price × quantity` reproduces the platform's line total). */
  price: number;
  quantity: number;
  imageUrl?: string;
  optionValues: Record<string, string>;
  variantOf?: string;
}

export function lineTotal(item: Pick<CartItem, 'price' | 'quantity'>): number {
  return Math.round(item.price * item.quantity * 100) / 100;
}

/** Where the customer completes the purchase the `checkout` card stages. Filled by the backend and rendered by the host; the model never supplies or sees the URL. */
export interface CheckoutHandoff {
  url: string;
  label?: string;
  seller?: string;
}

export interface Cart {
  items: CartItem[];
  currency: string;
}

/**
 * Cent-exact totals for the checkout card, in MINOR units as the platform sent them (never converted to the agent's major-unit floats: the
 * card formats them with the app's formatter, and routing a minor-unit field through a major-unit hook multiplies it twice). Absent fields
 * are absent: no shipping, tax or "estimated" figure is ever made up.
 */
export interface CartTotals {
  currency: string;
  /** Sum before discounts, when the platform sent a subtotal. */
  subtotalMinor?: number;
  /** Total savings, never negative; only when the platform sent a discount total that is not zero. */
  discountMinor?: number;
  /** What the platform says is payable for the cart. */
  totalMinor: number;
}

export function itemCount(cart: Cart): number {
  return cart.items.reduce((n, item) => n + item.quantity, 0);
}

/** Sum of line totals. May exceed what the shopper owes when the platform does not spread whole-cart discounts across lines: the model never renders money, the checkout card has its own cent-exact payload. */
export function subtotal(cart: Cart): number {
  return Math.round(cart.items.reduce((sum, item) => sum + lineTotal(item), 0) * 100) / 100;
}

/** Supplied by the backend before every turn; nothing the model does writes to it. */
export interface UserPreferences {
  userId: string;
  displayName?: string;
  /** Do not invent a tier the store does not model: absent is the honest value. */
  loyaltyTier?: string;
  defaultLocation?: string;
  preferences: Record<string, string>;
}

export type OrderStatus = 'processing' | 'shipped' | 'out_for_delivery' | 'delivered' | 'delayed' | 'cancelled' | 'return_initiated' | 'refunded';

export interface OrderItem {
  productId: string;
  title: string;
  quantity: number;
  price: number;
  optionValues: Record<string, string>;
  variantOf?: string;
}

export interface Order {
  orderId: string;
  /** Absent when the platform's state is not one the mapping knows: the order card is then refused and the model describes it in words. */
  status?: OrderStatus;
  /** ISO 8601; absent when the platform does not say. */
  placedAt?: string;
  items: OrderItem[];
  total: number;
  currency: string;
  /** Absent unless the platform really has an estimate. Never derived from a shipping method's name. */
  estimatedDelivery?: string;
  /** Absent unless the platform really has a URL (a tracking id and a carrier are not a URL). */
  trackingUrl?: string;
  /** The "View order" link for the card only (never serialized for the model): https and on the storefront's own host, or absent. */
  viewUrl?: string;
}

export interface Policy {
  policyId: string;
  title: string;
  category?: string;
  content: string;
}

export interface DisclosureRow {
  label: string;
  value: string;
  note?: string;
}

export interface Disclosure {
  title: string;
  productId: string;
  rows: DisclosureRow[];
  sources: string[];
  footnotes: string[];
}

export interface FulfillmentOption {
  method: 'delivery' | 'pickup' | 'shipping';
  eta: string;
  fee: number;
  location?: string;
}

export interface PageContext {
  pageType: 'home' | 'search' | 'product' | 'cart' | 'orders' | 'other';
  productId?: string;
  query?: string;
  extra: Record<string, unknown>;
}

/**
 * Per-request values. The principal is bound at session start from the signed cookie and never taken from a request body or a tool
 * argument. `signal` lets a backend honour cancellation (a Promise cannot be cancelled in JavaScript).
 */
export interface ShoppingSessionContext extends ClockContext {
  sessionId: string;
  userId: string;
  page: PageContext;
  /** Present only for a signed-in shopper. Order tools need it. */
  customerId?: string;
  anonymousId?: string;
  country?: string;
  locale?: string;
  currency?: string;
  signal?: AbortSignal;
}

/** Held by the host for the session. `seenProducts` is the provenance record: cart writes accept only ids in it, and presentation payloads are enriched from it. Insertion-ordered (a Map), so eviction order is arrival order. */
export interface ShoppingSessionState {
  seenProducts: Map<string, Product>;
}

export function newSessionState(): ShoppingSessionState {
  return { seenProducts: new Map() };
}

export function rememberProducts(state: ShoppingSessionState, products: readonly Product[], cap: number): void {
  for (const product of products) remember(state.seenProducts, product.productId, product, cap);
}

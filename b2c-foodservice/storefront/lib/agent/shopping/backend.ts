// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from shopping-agent/core/shopping_agent/backend.py; changes: TypeScript interface; policy, fulfilment and disclosure methods optional (those systems are switched off in this deployment); optional drainNotes channel for dropped filters.

import type {
  Cart,
  CheckoutHandoff,
  Disclosure,
  FulfillmentOption,
  Order,
  Policy,
  Product,
  ProductDetails,
  SearchFilters,
  ShoppingSessionContext,
  UserPreferences,
  CartTotals,
} from './types';

/** A signal the executor relays, not a failure. Thrown by a backend method for something this store does not provide for the item or context in hand, as opposed to a system that is down or not wired yet. A whole system the store lacks is switched off in the config instead. */
export class NotOffered extends Error {
  constructor(message = 'not offered') {
    super(message);
    this.name = 'NotOffered';
  }
}

/** Thrown by an order method when the shopper is not signed in. The executor tells the model to ask the customer to sign in (it is not an outage and not something the store lacks). */
export class SignInRequired extends Error {
  constructor() {
    super('sign in required');
    this.name = 'SignInRequired';
  }
}

/** Relayed like `NotOffered`, with its own wording. Thrown by `addToCart` for a product or variant that exists but cannot be bought right now (out of stock, not sold in this context). The message names ids only: what is unavailable and, for a variant, which sibling variants are in stock. Titles are catalogue text and stay inside fences. */
export class Unavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Unavailable';
  }
}

/**
 * The one integration surface an adopter implements. Everything these methods return reaches the model as fenced data. Every method
 * acts for the customer in `session`, calling that system's own API server-side with a credential the host holds for the session; the
 * model sees a method's result, never a token. The cart methods are the only writes; each arrives after the executor's provenance gate
 * and quantity caps and returns the whole cart, and the backend still enforces its own business rules atomically.
 *
 * NO METHOD PLACES AN ORDER OR MOVES MONEY. There is no such method, and the absence is the enforcement: `checkout` renders the cart
 * for the host to complete. `NotOffered` reaches the model as "not something this store offers"; any other exception as the tool being
 * temporarily unavailable, logged by the executor (tool name only).
 *
 * A search backend whose index is disabled, unreachable or unconfigured MUST THROW, never return `[]`: an empty list means "nothing
 * matched".
 */
export interface StorefrontBackend {
  // -- Catalogue
  /** The closest text matches, best first, at most `limit` (already clamped). A family is one result. */
  searchProducts(session: ShoppingSessionContext, query: string, filters?: SearchFilters, limit?: number): Promise<Product[]>;
  /** The full record for one id as the model wrote it, or null when unknown. A family's `variants` carries its purchasable records; the record and its variants enter provenance. */
  getProductDetails(session: ShoppingSessionContext, productId: string): Promise<ProductDetails | null>;

  // -- Cart
  getCart(session: ShoppingSessionContext): Promise<Cart>;
  /** A delta: add `quantity` to the line. The amount is already reduced so the line stays within the per-item cap. Never a family id. */
  addToCart(session: ShoppingSessionContext, productId: string, quantity: number): Promise<Cart>;
  /** A set. A product the cart does not hold leaves the cart as it is; that is not an error. */
  updateCartItem(session: ShoppingSessionContext, productId: string, quantity: number): Promise<Cart>;
  /** Same tolerance as `updateCartItem`. */
  removeFromCart(session: ShoppingSessionContext, productId: string): Promise<Cart>;

  /** Optional: cent-exact totals (minor units) for the `checkout` card, built from the platform cart. The model-facing cart total is the sum of line totals, which can exceed what the shopper owes when whole-cart discounts are not spread across lines; the card renders THIS. Null when the cart is empty. */
  getCartTotals?(session: ShoppingSessionContext): Promise<CartTotals | null>;

  // -- Customer context
  getPreferences(session: ShoppingSessionContext): Promise<UserPreferences>;
  /** Optional: where this cart is paid for when that is not a route in the host app. Attached to the `checkout` card after the model's call; never a tool argument. */
  checkoutHandoff?(session: ShoppingSessionContext, cart: Cart): Promise<CheckoutHandoff[]>;
  /** Optional account facts for the per-request context block. Sent on every request, so keep it small. */
  getAccountContext?(session: ShoppingSessionContext): Promise<Record<string, unknown> | null>;

  // -- Orders (the shopper's OWN orders only; ownership is enforced in the query, not by provenance)
  getOrders(session: ShoppingSessionContext, limit?: number): Promise<Order[]>;
  /** Null when the id is unknown OR belongs to someone else (indistinguishable). Accepts the order number as well as the internal id. */
  getOrder(session: ShoppingSessionContext, orderId: string): Promise<Order | null>;

  // -- Systems this deployment switches off (config enablePolicies/enableFulfillment/enableDisclosures); optional so a backend without them still type-checks.
  searchPolicies?(session: ShoppingSessionContext, query: string): Promise<Policy[]>;
  getFulfillmentOptions?(session: ShoppingSessionContext, productIds: string[]): Promise<FulfillmentOption[]>;
  getDisclosure?(session: ShoppingSessionContext, productId: string): Promise<Disclosure | null>;

  /** Optional (a divergence worth having): notes accumulated since the last call, such as "the price limit could not be applied". The executor appends them to the tool result so the model does not present an over-budget list as if it met the constraint. Feature-detected. */
  drainNotes?(): string[];
}

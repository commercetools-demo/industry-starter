// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Least-privilege scope registry (data only, no `server-only`). Add a scope here and in `.env.example` in the same commit;
// lib/scopes.test.ts fails when the two drift apart.
export interface ScopeDoc {
  scope: string;
  reason: string;
}

/** Scopes of the storefront's frontend (non-admin) API client. There is no admin client in the storefront. */
export const FRONTEND_SCOPES: readonly ScopeDoc[] = [
  { scope: 'view_project_settings', reason: 'read currencies, countries and languages for COUNTRY_CONFIG checks' },
  { scope: 'view_published_products', reason: 'product pages and search (published projection)' },
  { scope: 'view_products', reason: 'Product Search (listing and search), product type labels and stock (inventory entries)' },
  { scope: 'view_standalone_prices', reason: 'the standalone prices of the listing, product page and cart (all prices are standalone)' },
  { scope: 'view_recurrence_policies', reason: 'the frequencies of "Subscribe and save" on the product page' },
  { scope: 'view_categories', reason: 'category tree and category pages' },
  { scope: 'view_stores', reason: 'resolve the store from the URL path' },
  { scope: 'view_product_selections', reason: "the store's assortment (product selection) for search filters" },
  { scope: 'view_shipping_methods', reason: 'shipping choices at checkout (matching-cart: the delivery options and the free-shipping threshold of the cart)' },
  { scope: 'view_cart_discounts', reason: 'name each applied discount on the cart (expanded cart discount and product discount references)' },
  { scope: 'view_discount_codes', reason: 'state of a promo code on the cart (applied or not applied, and why)' },
  { scope: 'view_types', reason: 'read custom type definitions (vehicle fitment, garage)' },
  { scope: 'view_key_value_documents', reason: 'read the vehicle table (custom objects, container mau-vehicles)' },
  { scope: 'manage_key_value_documents', reason: 'shop as customer: mark the single-use handoff record (custom object, container malva-impersonation) active or ended' },
  { scope: 'create_anonymous_token', reason: 'anonymous sessions and carts' },
  { scope: 'manage_customers', reason: 'sign-in, registration, account area' },
  { scope: 'manage_orders', reason: "place and read the shopper's orders" },
  { scope: 'manage_sessions', reason: 'create Checkout sessions for the hosted checkout' },
  { scope: 'manage_recurring_orders', reason: "the account's Subscriptions page (list, skip, pause, resume, change frequency, cancel) and the subscription line of an order" },
  { scope: 'manage_payment_methods', reason: "the account's saved payment methods (list and delete)" },
];

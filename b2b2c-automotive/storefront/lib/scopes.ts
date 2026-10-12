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
  { scope: 'view_categories', reason: 'category tree and category pages' },
  { scope: 'view_stores', reason: 'resolve the store from the URL path' },
  { scope: 'view_product_selections', reason: "the store's assortment (product selection) for search filters" },
  { scope: 'view_shipping_methods', reason: 'shipping choices at checkout' },
  { scope: 'view_types', reason: 'read custom type definitions (vehicle fitment, garage)' },
  { scope: 'create_anonymous_token', reason: 'anonymous sessions and carts' },
  { scope: 'manage_customers', reason: 'sign-in, registration, account area' },
  { scope: 'manage_orders', reason: "place and read the shopper's orders" },
];

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The least-privilege scope registry, one list per credential set. Data only (no server-only).
// `lib/scopes.test.ts` keeps it identical to the `# <scope> : <reason>` lines of `.env.example`: add a scope to both in the same commit.
export interface ScopeDoc {
  scope: string;
  reason: string;
}

/** `CTP_SCOPES`: the frontend client (login, as-associate chain, store and role reads). */
export const FRONTEND_SCOPES: readonly ScopeDoc[] = [
  { scope: 'view_project_settings', reason: 'read currencies, countries and languages for COUNTRY_CONFIG checks' },
  { scope: 'view_published_products', reason: 'product data shown in the portal catalog screens' },
  { scope: 'view_categories', reason: 'category tree for assortment and filters' },
  { scope: 'view_stores', reason: "read the signed-in user's stores and the store switcher" },
  { scope: 'view_product_selections', reason: "read a store's assortment (product selection)" },
  { scope: 'view_associate_roles', reason: 'read associate roles to derive portal permissions' },
  { scope: 'view_business_units', reason: "list the signed-in customer's business units and read a unit's associates and role assignments" },
  { scope: 'view_types', reason: 'read custom type definitions (vehicle fitment, store settings)' },
  { scope: 'manage_customers', reason: "sign-in, account area and customer lookup for the reseller's staff" },
  { scope: 'manage_orders', reason: "read and update the reseller's orders" },
  { scope: 'manage_quotes', reason: 'quote lifecycle for the signed-in business unit' },
  { scope: 'manage_quote_requests', reason: 'quote requests for the signed-in business unit' },
  { scope: 'view_quotes', reason: 'read quotes' },
  { scope: 'manage_business_units', reason: 'company profile, addresses and invitations through the as-associate business unit endpoints (Admin and Buyer roles must be buyer assignable, see seed requests)' },
];

/** `CTP_ADMIN_SCOPES`: the seller-admin client. Workstreams T, U, V and W add theirs here and in `.env.example`. */
export const ADMIN_SCOPES: readonly ScopeDoc[] = [
  { scope: 'manage_key_value_documents', reason: 'read and refresh the Contentools JWT custom object' },
  { scope: 'manage_stores', reason: 'store name, logo and favicon, location fields and the supply and distribution channel lists (branches)' },
  { scope: 'manage_channels', reason: 'create and edit branch channels (address, geo location, branch-info)' },
  { scope: 'view_types', reason: 'read the store-settings and branch-info custom types before writing custom fields' },
  { scope: 'view_orders', reason: 'order counts and revenue per sales channel for the Channels tab' },
  { scope: 'manage_products', reason: 'branch stock: inventory entries on the branch supply channel (inventory has no scope of its own)' },
  { scope: 'view_standalone_prices', reason: 'read the branch prices shown in the branch stock drawer (writes go through the price module)' },
  { scope: 'view_recurring_orders', reason: 'active subscriptions and renewals on the dashboard (orders, reviews and inventory reads there use view_orders and manage_products above)' },
  { scope: 'manage_product_selections', reason: "catalog: add and remove products in the store's own selection (the master selection is read only)" },
  { scope: 'view_categories', reason: 'catalog: category tree for assortment filters' },
  { scope: 'manage_standalone_prices', reason: 'catalog: create, change and suspend the store retail and branch prices (also covers the price import)' },
  { scope: 'manage_product_discounts', reason: "catalog: the store's own product discounts" },
  { scope: 'manage_cart_discounts', reason: "catalog: the store's own cart discounts" },
  { scope: 'manage_discount_codes', reason: 'catalog: codes of the store cart discounts and their redemption counts' },
  { scope: 'manage_import_containers', reason: 'W: CSV product import through the Import API (the Import API host is derived from CTP_API_URL)' },
  { scope: 'view_customers', reason: "W: audience rules read the marketing consent and the order history of the store's customers (counts only are shown)" },
];

/** `CTP_PROVISION_SCOPES`: the provisioning client (registration endpoint only). No admin scopes and no project-wide manage scope. */
export const PROVISION_SCOPES: readonly ScopeDoc[] = [
  { scope: 'manage_business_units', reason: 'create the pending reseller business unit and its first administrator' },
  { scope: 'manage_customers', reason: 'delete the just-created customer when creating the business unit fails (compensation)' },
  { scope: 'view_stores', reason: 'resolve a store when the operator assigns it while approving' },
  { scope: 'view_associate_roles', reason: 'resolve the mau-role-admin role for the first administrator' },
];

# Project findings — `spec-test-b2c-telecom`

What is actually in the commercetools project, recorded by the workstreams that inspect it (F, G, L). No secrets here.

## Baseline (inspected 2026-10-07 by the planner through the commerce MCP)
- Project key `spec-test-b2c-telecom`, name "Spec test B2C - Telecom", trial until 2026-12, region `us-central1.gcp`.
- Countries GB, DE, US; currencies EUR, GBP, USD; languages en-GB, de-DE, en-US.
- `carts.countryTaxRateFallbackEnabled = true`, `taxRoundingMode = HalfEven`, `deleteDaysAfterLastModification = 90`.
- `searchIndexing.products = Deactivated` (to be activated by the seeder, D-056); `searchIndexing.orders = Activated`.
- Discount combination mode `Stacking`; inventory `reservationExpirationInMinutes = 30`.
- Three furniture sample product types exist: `bedding-bundle`, `furniture-and-decor`, `product-sets` (to be removed by the F cleanup script after OA-04).

## To be recorded
- F: scopes of the admin client, existing categories/products/inventory/stores/shipping/tax/customer groups before cleanup, what the cleanup deleted.
- G: inventory-mode finding (D-019), product-type creation results, search index lag measured.
- L: **checkout spike result** (recurring + one-time lines, `recurringPaymentConfiguration`, session creation) and the chosen fallback if it fails.

## F: inventory before cleanup (read through the commerce MCP, 2026-10-07)

Everything below was created 2026-10-07 15:19 by the project's sample-data loader ("B2C lifestyle" furniture and home decor).

| Resource | Count | Keys / notes | Cleanup plan |
| --- | --- | --- | --- |
| Product types | 3 | `bedding-bundle`, `furniture-and-decor`, `product-sets` | **delete** (after their products) |
| Products | 117 | all furniture/decor (rugs, glassware, sofas …), all published, images on `storage.googleapis.com/merchant-center-europe/sample-data/b2c-lifestyle/` | **delete** (unpublish, then delete) |
| Inventory entries | 134 | SKUs of those products (e.g. `SPC-06`, 100 on stock) | **delete** |
| Categories | 29 | roots `furniture`, `home-decor`, `new-arrivals`, `kitchen` and their descendants (`living-room-furniture`, `bar-and-glassware`, `room-decor`, `dinnerware`, `bedroom-furniture`, `bedding`, `serveware`, `collections`, `serving-platters`, `storage--tables`, `rugs`, `plates`, `bar-accessories`, `home-accents`, `the-minimalist`, `the-modernist`, `bakeware`, `glassware`, `cheese-trays`, `bowls`, `tables`, `beds`, `armchairs`, `sofas`, `the-traditionalist`) | **delete** (children first) |
| Product discounts | 2 | `Bakeware5EUROff`, `NewArrivals15pctOff` | **delete** |
| Cart discounts | 2 | `FurnitureBOGO` (needs a code), `FreeShip100` | **delete** |
| Discount codes | 1 | `BOGO` | **delete** |
| Orders | 5 | sample orders with furniture lines, store `b2c-retail-store` | **keep** (line items are snapshots; orders reference the tax category and shipping methods, which therefore stay) |
| Carts | 5 | all `Ordered` | **keep** |
| Customers | 6 | sample customers, e.g. `jen@example.de` | **keep** |
| Store | 1 | `b2c-retail-store`, no product selections | **keep** (unused; D-058) |
| Channels | 2 | `inventory-channel` (InventorySupply), `distribution-channel` (ProductDistribution) | **keep** |
| Zones | 2 | `europe` (DE, GB), `usa` (US) | **keep, adopt** (a country can sit in one zone only) |
| Shipping methods | 2 | `standard-shipping` (default, $500/€500 rate), `express-shipping` | **keep** (referenced by orders); BFF filters to `malva-*` methods |
| Tax categories | 1 | `standard-tax` (DE 19 %, GB 20 %, US 20 %, NC 4.75 %, NY 4 %) | **keep**; Malva adds its own 0 % category |
| Customer groups, custom types, product selections, standalone prices | 0 | | nothing to do |
| API scope facts | | search indexing `products` deactivated; `orders` activated | seeder activates product indexing (D-056) |

## F: cleanup executed (2026-10-07, by the planner, owner approval recorded as OA-04)
- Owner approved the scope "catalog plus sample customers, carts and orders" in chat on 2026-10-07 (broader than the table above: also orders, carts, customers and the store).
- Ran the one-off script `plan/recipes/one-off-cleanup-2026-10-07.mjs` (dry run first, then `--execute`) with the seed client. Deleted: discount codes 1, cart discounts 2, product discounts 2, orders 5, carts 5, customers 6, products 117, inventory entries 134, categories 29, product types 3, stores 1. No failures.
- Verified independently through the commerce MCP: products, product types, categories, inventory, orders, customers, cart discounts and stores all return `total: 0`.
- Kept: channels `inventory-channel` and `distribution-channel`, zones `europe` and `usa`, shipping methods `standard-shipping` and `express-shipping`, tax category `standard-tax`.
- Workstream F's own cleanup task (`cleanup-furniture.ts`) therefore only has to prove the project is clean (idempotent no-op) and keep the allow-list guard for future resets.

## Granted scopes (names only, read from the token responses 2026-10-07)
- **Storefront client (`site/.env.local`, OA-02):** create_anonymous_token, manage_customers, manage_key_value_documents, manage_my_payments, manage_order_edits, manage_orders, manage_payment_methods, manage_payments, manage_recurrence_policies, manage_recurring_orders, manage_sessions, manage_shopping_lists, view_cart_discounts, view_categories, view_customers, view_discount_codes, view_key_value_documents, view_order_edits, view_orders, view_payment_methods, view_payments, view_product_selections, view_products, view_project_settings, view_published_products, view_recurrence_policies, view_recurring_orders, view_sessions, view_shipping_methods, view_shopping_lists, view_standalone_prices, view_tax_categories, view_types.
- **Seed/admin client (`site/.env.seed`, OA-03):** manage_cart_discounts, manage_categories, manage_customer_groups, manage_customers, manage_discount_codes, manage_key_value_documents, manage_payment_methods, manage_products, manage_project, manage_recurrence_policies, manage_recurring_orders, manage_shipping_methods, manage_states, manage_tax_categories, manage_types (+ matching view_ scopes).
- **Not granted to the seed client:** `manage_orders`, `manage_zones`, `manage_stores`, `manage_order_edits`. The cleanup nevertheless deleted orders, carts and the store, so the platform accepted those with the granted scopes; if a later task gets a 403 on orders, carts, zones or stores, ask the owner to add the scope (note it in `QUESTIONS.md`).
- Recurring-orders and recurrence-policy scope names are confirmed present on both clients.

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

## Furniture cleanup inventory

Written by `npm run seed:cleanup -- --list` (read-only). The one-off cleanup of 2026-10-07 already removed the sample data; the script stays as an idempotent check and keeps the allow-list guard.

<!-- CLEANUP-LISTING:BEGIN -->
#### Delete set
- product types (0): (none)
- products (0): (none)
- cart discounts (0): (none)
- discount codes (0): (none)
- inventory entries (0): (none)
- categories (0): (none)

#### Not deleted (recorded only)
- orders (0): (none)
- carts (0): (none)
- customers (0): (none)
- shipping-methods (2): express-shipping, standard-shipping
- tax-categories (1): standard-tax
- zones (2): europe, usa
- stores (0): (none)
- channels (2): distribution-channel, inventory-channel
- cart-discounts (kept) (0): (none)

listing-sha256: ca357ca06aa02b07e100c9311f5ca87928c0d6ffec4d8fb61bdea4a5b46f680c
listing-generated: 2026-10-07T19:21:21.020Z
<!-- CLEANUP-LISTING:END -->

## Granted scopes (names only, read from the token responses 2026-10-07)
- **Storefront client (`site/.env.local`, OA-02):** create_anonymous_token, manage_customers, manage_key_value_documents, manage_my_payments, manage_order_edits, manage_orders, manage_payment_methods, manage_payments, manage_recurrence_policies, manage_recurring_orders, manage_sessions, manage_shopping_lists, view_cart_discounts, view_categories, view_customers, view_discount_codes, view_key_value_documents, view_order_edits, view_orders, view_payment_methods, view_payments, view_product_selections, view_products, view_project_settings, view_published_products, view_recurrence_policies, view_recurring_orders, view_sessions, view_shipping_methods, view_shopping_lists, view_standalone_prices, view_tax_categories, view_types.
- **Seed/admin client (`site/.env.seed`, OA-03):** manage_cart_discounts, manage_categories, manage_customer_groups, manage_customers, manage_discount_codes, manage_key_value_documents, manage_payment_methods, manage_products, manage_project, manage_recurrence_policies, manage_recurring_orders, manage_shipping_methods, manage_states, manage_tax_categories, manage_types (+ matching view_ scopes).
- **Not granted to the seed client:** `manage_orders`, `manage_zones`, `manage_stores`, `manage_order_edits`. The cleanup nevertheless deleted orders, carts and the store, so the platform accepted those with the granted scopes; if a later task gets a 403 on orders, carts, zones or stores, ask the owner to add the scope (note it in `QUESTIONS.md`).
- Recurring-orders and recurrence-policy scope names are confirmed present on both clients.

## F: seeding framework live run (2026-10-07, seed client, project spec-test-b2c-telecom only)
- `.env.seed` (owner's file) uses the names `CTP_PROJECT_KEY`, `CTP_AUTH_URL`, `CTP_API_URL`, `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET`, `CTP_SCOPES`; the seed loader maps them to the `CTP_SEED_*` names (only values read from the `.env.seed` file; the storefront process variables are never read). `.env.seed.example` documents the `CTP_SEED_*` names; both work.
- Seed client reads worked without extra scopes: zones, stores, orders, carts, customers, channels (`seed:cleanup --list` read all of them). Adopting zones needs no `manage_zones`.
- `seed:cleanup -- --list` on the live project: delete set empty (0 product types, products, categories, inventory, discounts, codes); `--execute --confirm-project spec-test-b2c-telecom` printed `Nothing to clean up.` (exit 0). The listing hash of the empty set is in the block above.
- `seed -- --confirm-project spec-test-b2c-telecom` created: tax category `malva-telecom-services` (US and DE rates 0), customer groups `consumer`, `small-business`, `employee`, `existing-customer`, recurrence policy `malva-monthly` (standard, 1 Months). Second run: all `unchanged`, no write.
- Adopted zones (written to the run context and printed): `US=usa`, `DE=europe`. No `malva-zone-*` zone was created.
- **Finding: shipping method predicates over an unknown attribute are rejected.** `POST shipping-methods` with predicate ``lineItemExists(attributes.`offer-kind` in (...)) = true`` answered `Unknown field 'attributes.offer-kind'.` because no product type defines `offer-kind` yet. The seeder now skips the two Malva shipping methods with the reason `attribute "offer-kind" is not defined by any product type yet; seed the product types first` (exit 4) and creates them in the first run after G has seeded the product types. The backtick escaping itself is still unproven (G-18 must confirm it with a live `matching-cart` call).
- **Finding: Product Search activation state is `searchIndexing.productsSearch.status`**, not `searchIndexing.products` (that field is the deprecated Product Projection Search index and stays `Deactivated`). After `changeProductSearchIndexingEnabled` (`enabled: true`, `mode: ProductsSearch`) `productsSearch.status` was `Activated` immediately (no `Indexing` state seen, zero products). `seed:settings -- --check-only` prints `product search: Activated`.
- `seed:verify` live: all 9 checks PASS (the shipping check reports `deferred until the product types define offer-kind`), `All checks passed.`
- `seed -- --confirm-project wrong-key` exits 2 and names the key found.

## Workstream F findings (2026-10-07)
- Product Search status lives at `searchIndexing.productsSearch.status` (Activated).
- `.env.seed` CTP_* variable names are mapped by `scripts/seed/lib.ts`; the file stays gitignored.
- Shipping methods `malva-shipping-standard` and `malva-delivery-digital` are deferred (seed exit 4 skip) until workstream G defines the product-type attribute `offer-kind`; the platform rejects shipping predicates over unknown attributes. C-F-2 is checked after G.

## H — catalog and search reads
Verified live on 2026-10-07 against `spec-test-b2c-telecom` through the dev window (`/api/dev/catalog`, `npm run dev`).
- Product Search field names confirmed: `productType` (exact, product type id), `name` with `language: 'en-US'|'de-DE'` (fullText and wildcard), `categoriesSubTree`, `categories` (distinct facet, reference), `variants.prices.centAmount|currencyCode|country`, `variants.sku` (exact, case-insensitive). Facet `ranges` named `priceBands` on `variants.prices.centAmount` (fieldType long, filter currency+country) returns buckets keyed by the range key.
- `variants.prices.recurrencePolicy` is NOT searchable (`Unknown field 'recurrencePolicy', use one of [centAmount, channel, country, currencyCode, currentCentAmount, customerGroup, discounted, id, validFrom, validUntil]`). Search price bands and price sorts therefore also see one-time prices (activation fee 2500 on cable offers): accepted for text search.
- Searches: `q=cable` 4 offers (including `malva-offer-cable-existing-customer`), `q=zzzz` 0, `q=MLV-CBL-500-24M` the cable 500 offer, `q=Appl` Apple Music and Apple TV+ (wildcard, substring), de-DE `q=unlimited` 3 offers. Index was current (no lag observed).
- Projections (`productProjections` with `priceCurrency`/`priceCountry`, `staged=false`) carry the raw `masterVariant.prices[]` of all markets (recurring price with `recurrencePolicy`, one-time price without) and `recurrencePrices[]`; the scoped `price` returns only the one-time price when both exist. `variant.availability` (`isOnStock`, `availableQuantity`) is present on variants with an inventory entry (equipment, handsets) and absent otherwise.
- Offer attributes arrive on `masterVariant.attributes` and every other variant; `enum` and `lenum` both carry `{key,label}` (label is a string for `enum`, a locale map for `lenum`); `highlights` is a set of locale maps. Plan `included-addons` holds product keys (`malva-spotify`), offer `included-offers` holds offer keys (`malva-offer-spotify`). Add-on tag attribute is `addon-tag` (not `tag`).
- Handset offer variants carry one one-time price plus several recurring prices (installment 12/24/36, lease 24). H exposes them as `OfferVariant.financedPrices`; they are never the "monthly price" of the offer.
- Category tree: one `GET /categories` call returns all 8 categories; order hints 0.1 to 0.5 give Phone plans, Wireless internet, Cable internet, Add-ons, Phones & devices. Add-on children slugs: `streaming-entertainment`, `security-and-protection`, `routers-and-equipment`.
- Listing data differs from the plan's C-H examples: cable internet lists 4 offers (`malva-offer-cable-existing-customer` $49.99 is an extra; eligibility is K's job) and phone plans list 5 (`malva-offer-phone-online-only` $45, unlimited, month-to-month only). de-DE prices are whole euros (`40 €`, `60 €`, `80 €`).

## Workstream G findings (2026-10-07; details in plan/reports/G-report.md)
- Inventory mode `None` is the only mode accepting service lines at order time; `TrackOnly`/`ReserveOnOrder` refuse them (OutOfStock). The app must check handset stock itself.
- An order with a recurring line needs a customer on the cart: guests cannot create one (conflicts with D-035; see QUESTIONS.md Q-007).
- An order needs a shipping address even for add-on-only carts.
- `OrderFromCartDraft.custom` cannot change the cart's custom type: type the cart `malva-order` from creation.
- Product Search: ~2 minutes from write to searchable (no 15-minute reindex seen).
- Platform limits: required set attributes refused (set attributes are optional), dots not allowed in price keys (`_` used), max 50 search expressions per query.
- ReserveOnOrder experiments consumed stock; a re-seed restored it.

### G: image hosts
- All 35 lock entries / 70 URLs are on `media.istockphoto.com`; none on `images.pexels.com`. No photographer, licence or rate-limit data in the response. A clean URL answers 301 to a sized variant, then 200 `image/jpeg`.
- These are iStock/Getty files: the "Photos from Pexels" credit text is inaccurate and public hotlinking is not covered. Acceptable for the demo under D-066; see QUESTIONS.md Q-008.

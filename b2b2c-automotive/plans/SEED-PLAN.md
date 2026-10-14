<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Seed plan: Malva B2B2C automotive

Status: **DRAFT v2** (2026-10-12, reconciled with the owner answers in `plans/notes/owner-answers.md`). Package: `seed/` (TypeScript, Node 20+, `@commercetools/platform-sdk` ^8, `@commercetools/ts-client` ^4, `tsx`, `vitest`). Workstreams: D (framework and platform model), E (parts catalog), F (stores, units, roles, customers). Open questions: `plans/notes/questions-seed.md` (Q-S01 ...).

**Owner decisions applied in v2:** Q-003 all prices are standalone prices; Q-005 branches are channels that carry stock and prices; Q-T03 no MAP floor; Q-O03 no territory blocking (store countries are informational); Q-V01 wholesale buying from Malva is out of scope (no wholesale store, contract prices, volume tiers, purchase order, payment terms, approval rules, Approver role); Q-J03 fitment is year ranges; Q-T06 tailored text and images publish at once (no review state); Q-Q06 subscriptions are sold fully; Q-P01 no email (no outbox, no mail data); Q-010 en-US is USD and US, de-DE is EUR and DE.

**Proof level:** everything below is proven offline (unit tests against an in-memory fake of the API, `tsc --noEmit`, `seed --dry-run --offline`). Nothing has run against `spec-test-b2b2c-automotive` yet: no credentials exist where this was written (OA-01). "What needs live credentials" is the last section.

## 1. Scope and sources

The seeded data must make every screen of the two sites demonstrable: `openspec/specs/consumer-storefront/{bootstrap-and-structure,theming-design,design-*}` and `openspec/specs/seller-portal/{bootstrap-and-structure,design-*}`, with `openspec/changes/b2b2c-automotive-design/design.md`. Dropped with Q-V01: `seller-portal/design-quick-order-and-cart`, `design-orders-quotes-invoices`, `design-approvals-and-roles`, `design-price-lists-and-saved-lists` (no seed data serves them). The prototype's placeholder names (Autoline, Hartmann, Northline, Lakeshore, Harbour, Maple Ridge, Honda Civic, Toronto, CAD, its brand, part number and price examples) do **not** appear in seed data; `src/data.test.ts` fails if they do. All parts, brands, resellers and people are synthetic (fictional brands; real car makes and models are used only as vehicle names for demo fitment, not as compatibility claims).

## 2. Key naming

Everything the seed owns has prefix `mau-`; custom object containers `mau-vehicles`, `mau-assortment`, `mau-site`. Exceptions: (a) one shared key outside the prefix, custom object `configuration` / `default-theme` (Contentools namespace; created only when missing, never deleted by `reset`); (b) the **contract keys** the other workstreams hard-code: custom types `store-settings`, `branch-info`, `malva-customer`, `malva-checkout`, `malva-line`, `malva-return-item` and order state `ready-for-pickup` (`CONTRACT_KEYS` in `src/data/base.ts`; `reset` accepts exactly these); (c) standalone price keys start with the SKU (below).

| Resource | Key pattern | Examples |
| --- | --- | --- |
| tax category, zone, shipping method | `mau-tax-parts`, `mau-zone-{de,us}`, `mau-ship-{standard,express,pickup}` | |
| product type | `mau-pt-{part,local-part,bundle}` | |
| category | `mau-cat-parts` > `mau-cat-<system>` > `mau-cat-<system>-<group>` | `mau-cat-brakes-pads` |
| product | `mau-part-<sku>`, `mau-bundle-<sku>`, `mau-local-<sku>` (sku lower case) | `mau-part-mlv-bp-41001` |
| SKU / variant key | master `MLV-<2 letters>-<5 digits>`, kits `MLV-KIT-7xxxx`, reseller-local `KW-` (north) and `SK-` (south) | `MLV-BP-41001` |
| standalone price | Malva base `<sku>__base-eur-de`, `<sku>__base-usd-us`; channel price `<sku>__<channelKey>` (EUR) and `<sku>__<channelKey>__usd` (USD). The channel scheme is the one workstream T writes | `MLV-BP-41001__mau-dist-north` |
| channel | warehouse `mau-supply-malva-dc`; reseller retail price channel `mau-dist-{north,south}`; branch `mau-br-<store>-<city>` | `mau-br-north-hamburg` |
| store | `mau-reseller-north`, `mau-reseller-south` (no wholesale store) | |
| product selection | `mau-sel-malva-master` (the master catalog resellers pick from, assigned to no store), `mau-sel-north`, `mau-sel-south` | |
| associate role | `mau-role-{admin,buyer}` | |
| business unit | `mau-bu-malva`, `mau-bu-malva-dach`, `mau-bu-{north,south}`, `mau-bu-<store>-<city>` | |
| customer | `mau-cust-<name>` (emails `*@example.com`) | |
| inventory | `mau-inv-<sku>-<channel suffix>` | |
| discounts | `mau-pd-<funder>-<name>`, `mau-cd-<funder>-<name>`, `mau-dc-<name>` | |
| recurrence policy | `mau-rp-{monthly,quarterly,half-yearly}` | |
| product tailoring | `mau-tl-<north\|south>-<sku>` | |
| order state | `ready-for-pickup` | |
| custom type | `store-settings`, `branch-info`, `malva-checkout`, `malva-line`, `malva-customer`, `malva-return-item`, `mau-business-unit-fields`, `mau-cart-discount-fields` | |

## 3. Data model

### 3.1 Parts (product type `mau-pt-part`, one variant per product)

48 master parts (47 priced, 1 pre-release), 3 Malva/reseller bundles, 4 reseller-local parts: 55 products, all in `priceMode: Standalone` with **no embedded price**. Fictional brands: Vektra (brakes), Kestrel (filters, oils), Voltaris (electrics), Alpendyn (suspension, mounts), Rheinwerk (cooling, belts), Nordlicht (lighting, sensors, wipers), Malva Select (house brand, economy tier).

| Attribute | Type | Searchable | Meaning and spec |
| --- | --- | --- | --- |
| `part-number` | text | yes | search by part number (listing: exact match first, bypasses fit-only, Q-L02) |
| `brand` | enum (7) | yes | brand facet, uppercase brand on card |
| `quality-tier` | enum `oem`, `oes`, `premium`, `economy` | yes | "BRAND · OEM" label on the detail page |
| `position` | enum front/rear/left/right/not-applicable | yes | part-specific facet |
| `warranty-months` | number | yes | warranty line |
| `oem-numbers` | set of text | yes | search by OE number (synthetic references, none real) |
| `fitment-keys` | set of text, **year ranges** | yes | see 3.2 |
| `universal-fit` | boolean | yes | wipers, bulbs, oils, coolant fit any vehicle |
| `core-charge-eur`, `core-charge-usd` | money | no | only alternator, starter, caliper, batteries |
| `recurring-eligible` | boolean | yes | **subscribable** (Q-Q06): 13 parts, among them every oil filter, both cabin filters and both wiper blade products |
| `size-spec` | text | no | specifications table |
| `popularity-rank` | number | yes | seeded rank for "Most popular" and the home block (Q-L01): 1 is most popular, absent = unranked; 14 ranked parts, all carried by both resellers |
| `related-skus` | set of text | yes | "Often bought together": 2 to 4 priced master parts of the same system (topped up from the next system for exhaust) |

There is no `map-floor-percent` attribute (Q-T03). Product `searchKeywords` carry part number, OE numbers and brand in both languages. Names and descriptions exist in `de-DE` and `en-US`. A pre-release part (`MLV-BP-41099`) has **no prices** ("Price pending", never 0). Pending-review local part `SK-2002` is created unpublished and kept out of every selection (Malva's review of reseller-created local products is unchanged by Q-V01 and Q-T06, which concern tailoring).

`mau-pt-local-part` has **no fitment attributes** (a local product cannot claim compatibility); attributes: part number, brand name, owning store, review state (`approved|pending|rejected`), recurring flag. `mau-pt-bundle`: `component-skus` (set), `component-quantities` (set of `sku:qty`), `bundle-discount-percent`, `owner-store`. Bundle price = components total minus discount (below the total and above zero, tested); a bundle is in a selection only when every component is.

### 3.2 Vehicle fitment (year ranges, flat, searchable; Q-J03)

- Part attribute `fitment-keys`: set of text, one value per vehicle **generation and engine** with the year **range**: `make|model|year-from|year-to|engine`, for example `Volkswagen|Golf|2012|2019|2.0 TDI`. There is no explicit per-year vehicle id and no expansion of a range into years. Flat text so Product Search can filter and facet on it (nested attributes are not searchable).
- Vehicle table: custom object container `mau-vehicles`, key `mau-veh-<make-model-generation-engine>`, value `{ make, model, generation, yearFrom, yearTo, engine, markets, fitmentKey }`. 13 generations, 26 records. The finder reads this table (dependent selectors make, model, year, engine; the year is matched against `yearFrom <= Y <= yearTo`), resolves one `fitmentKey`, and filters the listing with `fitment-keys = <key>` OR `universal-fit = true`. Fit badge: key in the part's set (or universal) = fits; otherwise does not fit (the part can still be added to the cart with a warning, Q-M02); no active vehicle = "select your vehicle".
- Customer garage (Q-J04, at most 5): customer custom type `malva-customer`, field `garage`, a JSON string `{ "vehicles": [ { "id", "make", "model", "year", "engine", "fitmentKey" } ], "activeId": "<id>" }`. The year is the shopper's own year (inside the key's range); `fitmentKey` is the join to parts. The four demo shoppers have garages. The anonymous garage is a cookie (J).
- Plate and VIN decoding is a mock provider only (Q-002); both would resolve to the same `fitmentKey`.

### 3.3 Categories

3 levels: root `Parts` > 8 systems (Brakes, Filters, Engine, Suspension and steering, Electrical and lighting, Cooling and heating, Exhaust, Fluids and care) > 24 groups (33 categories). Slugs in both languages include the system slug (`oil` exists twice).

### 3.4 Prices (all standalone, Q-003; step `prices`)

Every price is a standalone price (`/standalone-prices`, one per SKU, currency, country and channel); products have `priceMode: Standalone` and no embedded price. Standalone prices are indexed by Product Search, so price facets and sort work. Currencies EUR and USD only (Q-010: en-US = USD for country US, de-DE = EUR for country DE).

| Price | Scope | Count | Spec |
| --- | --- | --- | --- |
| Malva base | EUR country DE and USD country US (USD = EUR x 1.09 rounded to 10 cents, placeholder), no channel, no customer group, no tiers | 2 per priced master part and Malva bundle (98) | the store-wide price; also what a store shows when it sets none |
| Reseller retail | on the store's distribution channel `mau-dist-north` (EUR/DE) and `mau-dist-south` (EUR/DE and USD/US), for about half of the carried master items, factors 0.85 to 1.05 of the base | | `design-price-overrides-and-margin`; portal workstream T writes the same shape (`<sku>__<channelKey>`) |
| Reseller-owned items | local parts and the north bundle have **only** a channel price on the owner's distribution channel (no Malva base price), south also in USD | | visible in the owner's selection only |
| Branch | a branch channel carries its own price for about one in seven carried items, in the branch currency (Austin USD/US, the others EUR/DE) | | Q-005; storefront selects branch price, then store channel price, then base |

220 standalone prices in total. **No floor** (Q-T03): the only rule is a whole number of cents above zero (`checkPrices`, tested; the data even contains retail prices below 88 % of the base to show nothing enforces a floor). **No volume tiers and no customer-group or contract prices** (Q-V01). A pre-release part has no price at all. Branch channels have both roles (`InventorySupply`, `ProductDistribution`) and are listed in the store's `distributionChannels` next to the retail channel.

### 3.5 Stock

Central warehouse `mau-supply-malva-dc`: every priced master part, 150 to 549 units. Branches: the parts (and local parts) of their reseller's assortment, about 70 % in stock (1 to 28 units); the rest ships from the warehouse ("Ships in 2 to 3 days"). 209 inventory entries.

### 3.6 Platform model

- Tax category `mau-tax-parts`: DE 19 % included, GB 20 % included, US 0 % not included (placeholder for state sales tax, Q-S02). `carts.countryTaxRateFallbackEnabled` stays true so a US address without a state still resolves.
- Zones `mau-zone-de`, `mau-zone-us` serve shipping rates only. **No territory blocking** (Q-O03): store `countries` (DE, or DE and US) are informational; there is no territory field on stores or business units and nothing enforces a country. Shipping methods: standard (DE 5.90 EUR free above 150, US 9.90 USD free above 175), express (12.90 / 24.90), **pickup in store** (rate 0): the cart carries a branch (supply channel of the store) and custom field `pickupBranchKey`, line items use that `supplyChannel`, no address needed.
- No customer groups (contract tiers were wholesale only).
- Recurrence policies monthly, every 3 months, every 6 months, **in use** (Q-Q06): subscribable parts (`recurring-eligible`) can be added with any of them through checkout, account and portal. Recurring orders themselves are created by the apps.
- Order state `ready-for-pickup` (OrderState, `initial: false`, no `transitions`, so the platform does not validate). Orders and the account read it by key.
- **Custom types** (one type per resource kind, because a resource has one custom type; contract names are fixed by the plans of I, J, O, P, Q, U, W):

| Type key | Resource | Fields |
| --- | --- | --- |
| `store-settings` | store | `ownerBusinessUnitKey`, `currency`, `taxLabel`, `freeShippingThresholdCent`, `defaultCountry`, `shipDaysMin`, `shipDaysMax`, `timezone`, `helpUrl`, `trackUrl`, `returnWindowDays` (30, Q-Q01), location `addressLine`, `postalCode`, `city`, `countryCode`, `latitude`, `longitude`, `logoUrl`, `faviconUrl`. Also the type that P and Q call `malva-store` |
| `branch-info` | channel | `openingHours` (JSON `{"mon":["08:00","19:00"],...}`, a missing day is closed), `timezone`, `phone`, `pickupMode` (`same-day`, `next-day`, `ship-to-store`), `storeKey` |
| `malva-checkout` | cart and order | `mobile`, `pickupBranchKey`, `fitVehicleLabel`, `isTest`, `deliveredAt` (DateTime, set by the portal; return window starts here), `salesChannel`, `costCentre`, `placedOnBehalfBy`. One type on cart and order so cart fields copy to the order |
| `malva-line` | line item | `vehicleFitmentKey`, `vehicle` (JSON), `fit` (`fits`, `not-fit`, `unknown`), `parentLineItemId` |
| `malva-customer` | customer | `garage` (JSON), `preferredBranchKey`, `mobile`, `jobTitle` (portal users), `isDemo`, `marketingConsent`, `marketingConsentAt`, `lastActiveAt`. Also the type that J calls `customer-garage` |
| `malva-return-item` | order return item | `returnNumber`, `status` (`requested`, `in-transit`, `received`, `inspected`, `refunded`, `rejected`), `reason`, `refundCents`, `rejectReason`, `refundRequestedAt` (DateTime) |
| `mau-business-unit-fields` | business unit | `kind`, `storeKey`, `channelKey`, `legalName`, `taxId`, `accountNumber` (demo values on the two resellers) |
| `mau-cart-discount-fields` | cart discount | `fundedBy`, `storeKey` |

  Removed with the dropped features: `poNumber`, `dueDate`, credit and payment-terms fields, `territories`, `maxDiscountPercent`, `fitConfirmed`, any review or outbox field. No email or outbox data exists (Q-P01).

### 3.7 Stores, branches, assortment

- `mau-reseller-north` (DE, 3 branches Hamburg, Berlin, Bremen) and `mau-reseller-south` (DE and US, branches Munich, Stuttgart, Austin). Each: languages `de-DE`, `en-US`; distribution channels = the retail channel plus its branches; supply channels = warehouse plus its branches; `store-settings` fields. Branch channels carry address, geo location and the `branch-info` fields for the store picker (OpenStreetMap with Leaflet, I).
- There is **no wholesale store** (Q-V01): resellers pull from the Malva master catalog into their own selection, they do not buy from Malva in the app.
- Product selections (Individual mode): master 48 priced and pre-release parts plus 2 Malva kits (the pool a reseller picks from, assigned to no store); north 43 products; south 42. They differ by design: north has no exhaust and no US-only parts and withdrew the economy front pad; south has no belts or cooling, carries US parts, withdrew the diesel fuel filter (so the diesel kit is hidden); both lack the LED fog lamp (blocked upstream) and the pre-release part. Each reseller selection is assigned active to its store.
- `mau-assortment/<store>` custom object: `withdrawnByReseller`, `blockedUpstream`, `preRelease`, `pendingReview`: the portal states Withdrawn by you, Blocked upstream, Pre-release that a selection cannot express. "Never widen" is **not** enforced by commercetools (Q-S04); the portal service checks.
- Product tailoring (Q-T06): **text and images**, published at once, no review. 5 `product-tailoring` documents in the stores (3 north, 2 south): name and/or description in de and en, and for three of them images on the master variant (`variants: [{ sku, images }]`). No review object exists. Image URLs are clean (no query or fragment); until `seed:images` records real ones into `src/data/tailoring-images.json` (key `<store>--<sku>`, wins over the data), the seed uses neutral `placehold.co` URLs.

### 3.8 Business units, roles, customers

Chain (design-catalog-assortment): `mau-bu-malva` (Company, Malva Global) > `mau-bu-malva-dach` (Division) > `mau-bu-north` / `mau-bu-south` (resellers, custom fields `kind`, `storeKey`) > one Division per branch (`channelKey`). Business units have no `stores`, no customer group assignment and no territories. Roles exist only for reseller portal staff: `mau-role-admin` (business-unit administration, associates, view and update orders, view carts) and `mau-role-buyer` (view orders and carts, read only in the portal). **No Approver role**, no quote, approval or shopping-list permission; names are asserted against the SDK type. Associates: Admin and Buyer per reseller (inheritance enabled for branches), `malva.admin` at Malva Global ("Shop as" customer is Admin only, Q-W01). Shoppers are store-bound customers (`stores`), with addresses in DE or US and a garage; Anna and Liam have marketing consent recorded (never used to send mail).

No approval rules, quotes, purchase orders or payment terms are seeded. Orders and carts are not seeded either (the storefront creates them).

### 3.9 Discounts

Product discounts (only the highest ranked applies per product, so scopes are disjoint): Malva autumn filter promotion -10 % on Filters (Malva-funded, lowest sort order), north brake week -8 % on Brakes, south battery bonus -5 EUR / -5 USD on batteries. Cart discounts: Malva welcome -5 % (needs code, `fundedBy=malva`), north large order -3 % on carts from 2,000 EUR, south brake code -5 % (code, cart must contain brakes, so a mismatching cart shows "Not applied: cart doesn't match"), south free shipping (inactive, to show the toggle). Discount codes `MALVA-WELCOME5`, `SUEDKAMM-BRAKE5`. Predicates use `categoriesWithAncestors.key` / `categories.key` (keys, no ids).

**Sort order (Q-S05, decided from the docs, to be re-confirmed live by T-00):** a HIGHER `sortOrder` is prioritised (commercetools docs, "How Cart Discounts work": "A Cart Discount with a higher rank is prioritized"; the highest ranked active product discount wins). Malva-funded discounts therefore hold the band 0.91 to 0.99 (`mau-pd-malva-filter-autumn` and `mau-cd-malva-welcome` both 0.91, unique per kind), reseller ones 0.51 to 0.53 (T allocates its own in 0.05 to 0.89); values never end in 0. If T-00 finds the opposite direction, flip the numbers in `src/data/discounts.ts` and T flips `SORT_HIGHER_FIRST`.

**Store scope:** the three reseller cart discounts carry `stores` (`mau-cd-north-large-order` north; `mau-cd-south-brake-code` and `mau-cd-south-free-shipping` south, synced with `setStores`); the Malva-funded one has none (all stores). Product discounts have no `stores` field, so the two reseller product discounts get a predicate clause `and channel.id = "<id of mau-dist-north | mau-dist-south>"`, resolved at seed time (`PRODUCT_DISCOUNT_CHANNEL`, `channelClause`); consequence: they discount the store's retail-channel prices only, not a branch's own price or the Malva base price (Q-S19). `maxDiscountPercent` is not used anywhere.

### 3.9a Reviews and popularity (Q-L01)

22 plain `Review` resources (`mau-rev-<sku>-<n>`, no state, no approval gate, rating 1 to 5, author names synthetic, de-DE and en-US text) on 9 parts that **both** resellers carry, with different averages (3.0 to 5.0), so `reviewRatingStatistics` exists for "Top rated", the rating row and the PDP summary in either store. Workstream V later adds its own reviews with the custom type `malva-review` and review states; seeded reviews stay stateless and keep counting in the statistics (live check, TODO row M-E-02). `popularity-rank` (1 to 14) and `related-skus` are product attributes (3.1). Reset deletes the reviews first.

### 3.9b Pending local part review record

Custom object `malva-local-review/mau-reseller-south--mau-local-sk-2002` = `{ state: 'pending', claimedVehicles: [] }` (key `<storeKey>--<product key>`). Written only when missing (the portal owns it afterwards); `reset` deletes exactly that key, never the container. Not seeded (Q-S20): the demo co-op campaigns (`malva-coop-campaigns`) and e-mail templates (`malva-email-templates`), because their value shapes and default texts live in the portal (`ensure-w.mjs`, W-01, W-04) and a second writer would drift.

### 3.10 Contentools theme (documented, seeded)

Data shape is documented in `/Users/behnam/code/cms` (read only): `puck/packages/puck-types/src/theme-types.ts` (`ThemeTokens`) and `service/src/controllers/configuration.controller.ts` (custom object container `configuration`, key `{namespace}-theme`, value = the `ThemeTokens` object as is; namespace `default` is the fallback). The seed writes `configuration/default-theme` with the Garage Maroon tokens of `design/export/tokens.automotive.css` (primary `#821810`, hover `#911c14`, secondary `#000000`, accent `#d1a04a`, Poppins), **only when missing**, so ThemeManager edits are never overwritten. Not seeded: per-store themes (`{storeKey}-theme`), Puck pages and content, the Contentools JWT object (`contentools-configuration/contentools-jwt-token`, written by the Merchant Center app, OA-02). Logo and favicon URLs come from the Contentools `upload-file` and are stored in `store-settings` by the portal (Q-U01); the seed leaves them empty.

### 3.11 Images

`seed:images` records clean Image source URLs into `src/data/product-images.json` (55 product keys), `category-images.json` (8 system keys, stored as category `assets`), `banner-images.json` (3 slots, stored as custom object `mau-site/banner-images`) and `tailoring-images.json` (3 tailored products, key `<store>--<sku>`). Seed applies them when present and re-applies when they change. Build id, shape assumption and the 403 behaviour are in `seed/README.md` and `src/images.ts`; status OA-03.

## 4. Order of `seed` (dependency order)

`settings` (search indexing, tax fallback; waits for Activated) > `tax-shipping` > `product-types` > `categories` > `types` > `states` > `channels` > `recurrence` > `vehicles` > `products` > `prices` > `inventory` > `reviews` > `stores` > `selections` (create, fill, assign to stores) > `roles` > `customers` > `business-units` (parents first) > `discounts` > `tailoring` > `content` (assortment objects, default theme, banner images). Reference by **key** everywhere. `--only` runs a subset; the fake API rejects an unresolved reference, so the order is tested (running `products` alone fails with ReferencedResourceNotFound).

## 5. Idempotency

Each step reads the resource by key; missing = create, present = compare with `src/sync.ts` and send only the difference, so a second run reports `0 change(s)` and sends no write (tested with a write counter). Synced: review rating, title and text, cart discount `stores`, product discount predicate, product name, description, attributes (normalised: enum objects, money, sets), images, standalone price value (`changeValue`), category name, channel name, store settings and links, selection membership (adds and removes: selections are seed-owned), role permissions, inventory quantity, discount sort order, active flag and predicate, business unit name and missing associates, custom type fields and product type attributes (only added, never removed or retyped), tailoring text and images (always followed by `publish` in the same request). Create-only: tax categories, zones, shipping methods, states, recurrence policies, customers, discount codes. Custom objects: written only when the value differs; the default theme only when missing. Every update uses the version just read (a 409 would abort the step). To rebuild after changing create-only data: `npm run reset` then `npm run seed`.

## 6. Cleanup allow-list

`src/data/sample-allowlist.ts`, taken from read-only MCP reads on 2026-10-12: 72 products, 42 categories (3 levels), 3 product types (`generic-product`, `heavy-earthmoving-and-construction-equipment`, `heavy-lifting-and-specialized-equipment`), shipping methods `standard-shipping-method` and `premium-shipping-method`, tax category `standard-tax`, zones `europe` and `north-america`, 8 channels, 2 product discounts, 2 cart discounts, 4 recurrence policies, and the standalone prices of the 7 sample SKUs (78 prices; the sample products use standalone price mode). Beyond what the brief named, the project also held standalone prices, channels, discounts and recurrence policies; they are deleted because the sample prices reference them (Q-S07). **Left in place:** the three sample associate roles (`approver` and two more) and anything not listed. Rules: list, then keep only listed keys (standalone prices: listed SKUs); refuse `mau-` keys; counts printed (`listed / to delete / left in place`); `--dry-run`; real run needs matching `EXPECTED_PROJECT_KEY` and `--confirm <projectKey>`. Order: standalone prices, products (unpublish first), product and cart discounts, shipping methods, tax categories, zones, categories (deepest first), product types, recurrence policies, channels; the fake API enforces "cannot delete what is referenced", so the order is tested, including a customer product that must survive. `reset` deletes the seed's standalone prices first (they reference channels), only those whose key matches `isSeedPriceKey`.

## 7. What `verify` checks

Project: search indexing Activated, fallback true, languages `de-DE` `en-US`, countries DE US, currencies EUR USD. Platform: tax rates DE 19 %, GB 20 %, US 0 %; zones, shipping methods, product types, custom types (and that every contract key is defined), order state `ready-for-pickup`, channels, recurrence policies, roles and their permissions. Categories: all 33, groups at level 3. Each of the 55 products: exists, published as intended, `priceMode` Standalone, no embedded price, image URLs clean, required attributes present, fitment keys or universal fit. **Standalone prices:** every one of the 220 present with the right SKU, value, country and channel; every amount a whole number of cents above 0 (no floor check); EUR/DE and USD/US base price for each priced part; no price for the pre-release part. Inventory entries all present. Selections: membership equals the assortment, north and south differ. Stores: selection assigned and active, retail channel and branches as distribution channels, branches and warehouse as supply channels. Business units with associates, customers by key and email, discounts (sort orders by synced value, cart discount `stores`, channel clause on the reseller product discounts), codes, reviews (all present with their rating), popularity rank and related SKUs on each part, the pending local review record, tailorings (exist, published, clean image URLs), vehicle table size, assortment objects, default theme. Not covered: Product Search results (probe through the MCP `read_product_search`).

## 8. What needs live credentials (OA-01) or the owner

1. Everything: no step has run against the project. First live run order in `seed/README.md`; gate G2 (settings, sample data gone) and G3 (parts, two resellers, Product Search returns parts) are checked by Claude through the MCP afterwards.
2. Product Search activation time (the seed waits up to 15 minutes), `searchKeywords` effect, and that standalone prices (with channel) appear in price facets and sort.
3. API behaviours the fake cannot prove: standalone price scope uniqueness and creation for a SKU, a channel with both roles used as a price channel, product tailoring with `variants[].images` in a store (create, `setExternalImages`, publish), business unit creation with `associateMode`, discount predicates, customer creation with `stores` and a custom type, `setProductSelections`, recurrence policy creation, order state creation without `transitions`, custom type on `order-return-item`.
4. `seed:images` (OA-03, your-loyalty-free-image-source.com answers 403 from the build environment; shape assumption unverified).
5. Contentools JWT (OA-02), per-store themes (ThemeManager), Stripe test account and connector (OA-05, Q-012).
6. Owner answers in `plans/notes/questions-seed.md`.

<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream F: Seed 3, stores, branches, selections, business units, roles, customers, discounts

**Goal:** two reseller stores with different assortments, retail prices, branches and stock; the Malva to branch business-unit chain with Admin and Buyer associates; demo shoppers with garages; discounts, product tailoring (text and images, published at once) and the default Contentools theme.
**Depends on:** E
**Implements:** (none: seed scripts, see `plans/SEED-PLAN.md` sections 3.7 to 3.10)
**Specs served:** `consumer-storefront/design-store-picker` and `design-storefront-shell` (branches, store settings), `design-product-listing-page` and `design-home-page` (reseller assortment only), `design-cart-page` and `design-checkout-page` (discount lines, pickup), `design-account-area` (shopper accounts and garage), `theming-design` (default theme), `seller-portal/design-catalog-assortment` (authority chain, states), `design-product-info-tailoring` (tailored text and images), `design-discounts-and-priority`, `design-brand-partnership` (informational store countries, pending content), `design-company-and-account` (Admin and Buyer), `design-customers-and-subscriptions`, `design-store-and-channels`, `design-storefront-theme-and-branding`, `design-auth-screens` (demo users). Dropped by Q-V01: `design-approvals-and-roles` (no Approver role, no approval rules).

**Owner answers applied (2026-10-12):** Q-V01 no `mau-malva-wholesale` store, no contract customer group on units, no Approver (users or role), no approval-rule data; the master selection stays as the pool resellers pick from but is assigned to no store; Q-O03 no territories (store `countries` are informational, no field on stores or units); Q-005 branches are distribution and supply channels (stock and prices); Q-T06 tailoring has images, no review states or objects; Q-J04 garage is a customer custom field (JSON); Q-P01 no email data (consent is recorded, nothing is sent); Q-W01 Admin may "Shop as"; Q-004 no review gate for themes and pages.
**Skills:** commercetools-commerce-patterns (BU hierarchy, associate roles, catalog architecture, discount stacking), commercetools-storefront (BOPIS, stores, as-associate chain), commercetools-platform

## Design decisions

1. **One store per reseller** (Q-005, design open question E): `mau-reseller-north` (DE; Hamburg, Berlin, Bremen) and `mau-reseller-south` (DE and US; Munich, Stuttgart, Austin). Branches are **channels** with both roles (`InventorySupply` and `ProductDistribution`) and the custom type `branch-info` (hours, pickup mode, phone); they are listed as supply and distribution channels of their store, so a branch carries stock and, optionally, its own standalone prices. There is **no third (wholesale) store** (Q-V01).
2. **Assortment = one product selection per reseller**, assigned active to the store. The Malva master selection `mau-sel-malva-master` exists as the pool resellers pick from and is assigned to no store. Selections differ on purpose (SEED-PLAN 3.7). The states a selection cannot express live in `mau-assortment/<store>`. "Never widen" is a portal service rule (Q-S04).
3. **Roles:** `mau-role-admin` and `mau-role-buyer` (reseller portal staff) with permissions validated against the SDK type; no Approver and no quote, approval or shopping-list permission. Associates are assigned on reseller units with inheritance so branch units inherit them.
4. **Business units:** Company `mau-bu-malva` > Division `mau-bu-malva-dach` > resellers > branch divisions. Units carry only the custom fields `kind`, `storeKey`, `channelKey`: no store assignment, no customer group, no territories.
5. **Customers** use `@example.com`, password from `SEED_DEMO_PASSWORD` (at least 10 characters, never stored in the repo or the log); shoppers are bound to their store and carry a garage as JSON in `malva-customer.garage` (vehicles with the shopper's year plus the year-range `fitmentKey`, at most 5) and a recorded marketing consent. Nine customers: four shoppers, Admin and Buyer per reseller, `malva.admin`.
6. **Discounts:** Malva-funded ones take the lowest sort orders; product discounts have disjoint scopes (only one applies per product); one code needs a matching cart. Direction of sortOrder is confirmed live (Q-S05). No discount band field (`maxDiscountPercent` removed with the portal rule).
7. **Tailoring (Q-T06):** every tailoring is a real product tailoring in the store with name, description and optionally images on the master variant, published in the same request. No pending or rejected state, no review object. Image URLs are clean; placeholders until `seed:images` records `tailoring-images.json`.
8. **Theme:** only `configuration/default-theme` is written, only when missing, shape from the Contentools sources. Per-store themes belong to ThemeManager.
9. Nothing for wholesale is seeded (no approval rules, quotes, purchase orders); carts, orders, subscriptions and recurring orders are created by the apps.

## Tasks

- [ ] F-01 `seed/src/data/org.ts` (channels with `branch-info` fields, `store-settings` fields, stores, Admin and Buyer roles, business units, customers with JSON garages) and `seed/src/drafts.ts`; tests: two stores only (no wholesale), retail channel plus branches as distribution channels, branch hours in the `{"mon":["08:00","19:00"]}` shape, role permissions valid and no approval or quote permission, chain order, associates reference customers, garages reference vehicles with the shopper's year inside the key's range, no territory data [SKILL: commercetools-commerce-patterns]
- [ ] F-02 `seed/src/data/assortment.ts` (selection rules, withdrawn, blocked, pre-release, pending review) with tests: north and south differ, blocked and withdrawn absent, bundle hidden when a component is missing, local items only in the owner's store [SKILL: commercetools-commerce-patterns]
- [ ] F-03 `seed/src/seed.ts` steps `stores`, `selections` (create, fill, assign), `roles`, `customers`, `business-units`; tests: selection sizes 43 and 42, assignment active, drift repair of selection membership and store assignment [SKILL: commercetools-storefront]
- [ ] F-04 `seed/src/data/discounts.ts` and step `discounts`; tests: Malva first, unique sort orders, code requires matching cart [SKILL: commercetools-commerce-patterns]
- [ ] F-05 `seed/src/data/content.ts` (default theme, tailorings with images, image slots) and steps `tailoring`, `content`; tests: tailorings publish at once with clean image URLs and no state field, a changed tailored image is re-applied and published once, default theme only when missing, required `ThemeTokens` fields [SKILL: commercetools-commerce-patterns]
- [ ] F-06 `seed/src/verify.ts` store, selection, unit, customer, discount, tailoring (published, clean images) and object checks; `npm run verify` green on a seeded fake [SKILL: commercetools-platform]
- [ ] F-07 Live run (OA-01): `seed` (steps `stores` to `content`), `verify` [SKILL: commercetools-platform]
- [ ] F-08 Claude reads back through the MCP (recipe below) and confirms gate G3 (two resellers with different assortment, prices, branches; Product Search returns the parts) [SKILL: commercetools-storefront]
- [ ] F-09 Sign in as a demo associate and shopper through the SDK (dev script, no secrets in output): the Admin sees units and roles, the Buyer lacks `UpdateAssociates`, a shopper reads only their store's products, and a shopper's `malva-customer.garage` parses to their vehicles [SKILL: commercetools-storefront]

## Test scenarios

| # | Scenario | Given | When | Then |
| --- | --- | --- | --- | --- |
| F-S1 | Different assortments | both stores seeded | read selection members | 43 vs 42 products, different sets |
| F-S2 | Withdrawn | north withdrew the economy front pad | listing for north | absent; present in south |
| F-S3 | Blocked upstream | LED fog lamp | any reseller selection | absent; `mau-assortment` lists the reason |
| F-S4 | Bundle rule | diesel kit | south (fuel filter withdrawn) | bundle absent in south, present in north |
| F-S5 | Local part | `KW-1001` | south selection | absent; pending `SK-2002` absent everywhere |
| F-S6 | Store countries | north `DE`, south `DE`+`US` | read stores | `countries` as seeded; informational only, no territory field and nothing blocks a country (Q-O03) |
| F-S7 | Branches | north | read channels | 3 branches with address, geo location, `branch-info` hours and pickup mode, roles supply and distribution; branch stock and some branch prices |
| F-S8 | Roles | Admin, Buyer | read roles | exactly two roles; Buyer lacks `UpdateAssociates`; no approval or quote permission |
| F-S9 | Chain | BU tree | read business units | Global > DACH > reseller > branch; no store, group or territory on the units; no wholesale store exists |
| F-S10 | Shopper | `anna.schneider@example.com` | read customer | bound to north, `garage` JSON with two vehicles (shopper's year inside the key's range), `activeId` set, marketing consent recorded |
| F-S11 | Discount order | Malva promotion and reseller discount | read discounts | Malva promotion has the lowest sort order |
| F-S12 | Wrong code | `SUEDKAMM-BRAKE5` on a cart without brakes | storefront cart (later) | not applied, reason shown |
| F-S13 | Tailoring | north tailoring with image | read product projection with store projection `mau-reseller-north` | tailored name, description and image at once; a product without tailoring shows master data; no review state exists |
| F-S14 | Theme | no reseller theme | read `configuration/default-theme` | Garage Maroon tokens, not overwritten on re-seed |
| F-S15 | Idempotent | all seeded | second `seed` | 0 changes |

## Browser / MCP recipe

No UI. Claude, through the `b2b2c-automotive` MCP (read only), after F-07:
1. `read_stores`: two stores with languages, countries, distribution channels (retail plus branches) and supply channels, product selection assigned, `store-settings` custom fields.
2. `read_product_selections`, then each selection's product count (`read_product_selection_assignments` for the stores): 50 master side (not assigned to a store), 43 north, 42 south.
3. `read_channels where roles contains any "InventorySupply"`: warehouse plus 6 branches with `branch-info` `custom.fields`.
4. `read_business_units expand associates[*].customer`: chain and associates (Admin and Buyer); `read_associate_roles`: two seed roles.
5. `read_customers where email = "anna.schneider@example.com"`: store, `malva-customer` garage JSON and consent.
6. `read_product_discounts`, `read_cart_discounts`, `read_discount_codes`: sort orders, predicates, flags.
7. `read_product_tailoring`: 5 published documents, 3 with variant images; `read_custom_objects container=configuration key=default-theme`.
8. `read_product_projections storeProjection=mau-reseller-north` vs `mau-reseller-south`: different product sets, prices per channel.
9. `read_product_search` with the store projection: parts found for each reseller.

## Definition of done

`npm run check` green; F-07 to F-09 done with evidence; `npm run verify` exits 0 live; two resellers read back with different assortment, prices and branches (gate G3); second `seed` reports 0 changes; no demo password in any file or log; owner informed of Q-S04 to Q-S06, Q-S12.

## Evidence to record (in `plans/evidence/F/`)

`seed` and `verify` logs; MCP excerpts per recipe step (store with channels and selection, selection sizes, BU tree, role permissions, one customer, discount sort orders, tailoring documents with images, theme object); the two product projections side by side; sign-in test output with tokens removed.

## Questions to the owner (defaults apply until answered)

| ID | Question | Default |
| --- | --- | --- |
| Q-S03 | ~~Third store `mau-malva-wholesale` for resellers buying from Malva?~~ | **Answered Q-V01: no.** Wholesale buying is out of scope; the store, contract groups and their prices are removed |
| Q-S04 | "Never widen" enforced in the portal service only? | Yes |
| Q-S05 | sortOrder direction (lower or higher fires first)? | Malva lowest, confirmed live |
| Q-S06 | South ships to the US (USD, en-US)? | **Answered Q-010:** en-US is USD and US, de-DE is EUR and DE. South keeps DE and US (informational, nothing blocks a country, Q-O03) |
| Q-S09 | ~~Seed a below-floor price for the flags demo?~~ | **Void: no MAP floor (Q-T03)** |
| Q-S11 | ~~Create approval rules in workstream V via the as-associate API?~~ | **Void: approvals are wholesale only (Q-V01), workstream V is removed** |
| Q-S12 | Extra Contentools themes beyond the default? | No |

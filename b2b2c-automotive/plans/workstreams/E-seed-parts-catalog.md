<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream E: Seed 2, parts catalog, fitment, images, prices, stock

**Goal:** about 40 realistic synthetic parts (48 master parts, 3 bundles, 4 reseller-local parts) with vehicle fitment (year ranges), quality tiers, brands, OE numbers, the subscribable flag, EUR and USD **standalone prices** (Malva base, reseller retail on the store's distribution channel, branch prices) and stock, in `de-DE` and `en-US`, plus the image recorder.
**Depends on:** D
**Implements:** (none: seed scripts, see `plans/SEED-PLAN.md` sections 3.1 to 3.5 and 3.11)
**Specs served:** `consumer-storefront/design-product-listing-page` (brand, position, fit filters; part-number and OE search; price unavailable; out of stock at store), `design-product-detail-page` (brand and quality label, fit banner data, specifications, compatible vehicles, savings, subscribe option), `design-vehicle-finder-and-garage` (fitment data), `design-home-page` (popular products, category tiles), `design-cart-page` (promo codes), `seller-portal/design-catalog-assortment` (pre-release, price pending), `design-price-overrides-and-margin` (base price, retail price, margin; no floor), `design-bundles-and-product-import` (bundles, local parts without fitment), `design-product-info-tailoring` (locked fields). Dropped by Q-V01: `design-price-lists-and-saved-lists`, `design-quick-order-and-cart` (contract and volume prices, core-charge price lists for buyers).

**Owner answers applied (2026-10-12):** Q-003 every price is a standalone price, Malva base price included (no embedded price, `priceMode: Standalone`); Q-005 branch channels carry stock and prices; Q-T03 no MAP floor (attribute, tests, verify check and portal rule removed; price sanity above zero stays); Q-V01 no contract prices, no volume tiers, no customer groups; Q-J03 fitment is year ranges (`make|model|year-from|year-to|engine`, no per-year ids); Q-Q06 subscriptions sold: `recurring-eligible` is the subscribable flag; Q-010 en-US is USD and US.
**Skills:** commercetools-commerce-patterns (pricing models, bundles, catalog architecture), commercetools-catalog-migration (SKU, slug, price conversion rules), commercetools-platform

## Design decisions

1. **Fitment is flat and year-range shaped (Q-J03).** `fitment-keys` is a searchable set of text, one value per vehicle generation and engine `make|model|year-from|year-to|engine` (for example `Volkswagen|Golf|2012|2019|2.0 TDI`); there is no explicit per-year vehicle id and no expansion; universal parts carry `universal-fit = true`. The vehicle table is the custom object container `mau-vehicles` (workstream D, 26 records with `yearFrom`, `yearTo`). The finder matches the shopper's year to the range, resolves one key from four selectors; the listing filters on it. Nested attributes are not searchable, so none are used. (Plans J, L, M still describe `fitsVehicles` / `fitsAll` explicit ids: they read `fitment-keys` / `universal-fit` instead.)
2. **All prices are standalone prices (Q-003)**, in step `prices` after `products`. Products are `priceMode: Standalone` with no embedded prices. Malva base price: EUR/DE and USD/US, no channel, no customer group, no tiers. Reseller retail price: standalone price on the store's distribution channel (`mau-dist-north`, `mau-dist-south`) for about half of the carried parts. Reseller-owned items (local parts, own bundle) have only the owner channel price. Branch channels carry their own price for about one in seven items (Q-005). Key scheme `<sku>__base-eur-de`, `<sku>__base-usd-us`, `<sku>__<channelKey>`, `<sku>__<channelKey>__usd`. A pre-release part has no price at all, never 0. 220 standalone prices.
3. USD price = EUR x 1.09 rounded to 10 cents (placeholder rate, documented, easy to replace by a price table); EUR is for country DE, USD for country US.
4. Brands are fictional, part numbers `MLV-XX-NNNNN` and OE numbers are synthetic, prototype names and SKUs are banned by a test.
5. **There is no price floor (Q-T03).** The only price rule is a whole number of cents above zero (`checkPrices`, test). Retail factors run from 0.85 to 1.05 of the base and a test asserts that below-88 % retail prices exist, so nothing silently re-introduces a floor. No wholesale prices: no contract prices, no volume tiers, no customer groups (Q-V01).
6. Local parts have no fitment attributes; bundles list components as SKUs and are priced at the components total minus the discount (below the total, above zero).
6a. **Subscribable parts (Q-Q06):** attribute `recurring-eligible` (label "Subscribable"), true for 13 parts including every oil filter, both cabin filters and both wiper blade products, plus one reseller-local screen wash; the recurrence policies of workstream D (monthly, every 3, every 6 months) apply to any of them.
7. Stock: warehouse for every priced master part, branches for the parts of their reseller's assortment (about 70 % in stock) so both "Pickup today" and "Ships in 2 to 3 days" occur.
8. Images: `seed:images` sends exactly `GET https://your-loyalty-free-image-source.com/_next/data/<buildId>/en-US/search/<query>.json?query=<query>`, records clean URLs into `src/data/{product,category,banner}-images.json`, never bypasses Cloudflare (403 or "Just a moment" fails with a message naming OA-03). The seed uses recorded images when present and leaves images empty otherwise.

## Tasks

- [ ] E-01 `seed/src/data/parts.ts` (48 parts over 7 brands, 4 tiers, 8 systems and all 24 groups, fitment from `fits()`, core charges on 5 parts, 13 subscribable parts) and `seed/src/data/vehicles.ts`; tests: counts, fitment keys are year ranges and exist in the vehicle table, universal parts, pre-release part, subscribable parts include oil filter, cabin filter and wipers [SKILL: commercetools-commerce-patterns]
- [ ] E-02 `seed/src/data/pricing.ts` (helpers, retail factors) and `seed/src/data/prices.ts` (standalone price set: Malva base, reseller retail, owner-only items, branch prices; key scheme; `isSeedPriceKey`); tests: every priced part has EUR/DE and USD/US base without channel, group or tiers, retail on the distribution channel, owner-only items, branch prices in the branch currency, all amounts above zero, below-88 % retail exists (no floor), keys unique [SKILL: commercetools-commerce-patterns]
- [ ] E-03 `seed/src/data/items.ts` (bundles, local parts) and `seed/src/data/catalog.ts` (product drafts in `priceMode: Standalone`, attributes, search keywords, images); tests: bundle price rule, no embedded prices, local parts without fitment, names in both languages, unique keys, SKUs and slugs [SKILL: commercetools-catalog-migration]
- [ ] E-04 `seed/src/data/extras.ts` inventory drafts (warehouse and branch stock); tests: every part in the warehouse, branch gaps [SKILL: commercetools-commerce-patterns]
- [ ] E-05 `seed/src/seed.ts` steps `products`, `prices` and `inventory` (create, then sync attributes, text, images, standalone price values, quantities through `src/sync.ts`); tests in `src/seed.test.ts`: idempotent, drift repair (a changed standalone price comes back with one `changeValue`), images added once, all prices standalone, none for the pre-release part [SKILL: commercetools-platform]
- [ ] E-06 `seed/src/images.ts` and `seed/src/fixtures/image-source-search.json`; tests in `src/images.test.ts`: exact URL, documented shape from the fixture, clean URLs, deep-search fallback, 403 and challenge page fail with OA-03, `--dry-run` uses no network, `--only`, `--count`, merge into existing JSON, stop at first block [SKILL: commercetools-platform]
- [ ] E-07 `seed/src/verify.ts` product checks (`checkProduct`: price mode Standalone, no embedded price, clean images, attributes) and price checks (`checkPrices`: each seeded standalone price present with SKU, value, country and channel, amount above zero, EUR and USD base per priced part, none for the pre-release part; no floor check); tests with deliberately broken products and prices [SKILL: commercetools-platform]
- [ ] E-08 Live run (OA-01): `seed` (steps `products`, `inventory`), then `seed:images` from a machine that can reach your-loyalty-free-image-source.com (OA-03), then `seed` again to apply the images [SKILL: commercetools-platform]
- [ ] E-09 Claude's data check through the MCP (recipe below), including Product Search [SKILL: commercetools-platform]

## Test scenarios

| # | Scenario | Given | When | Then |
| --- | --- | --- | --- | --- |
| E-S1 | Fit data | part with fitment keys | listing filters on `fitment-keys = Volkswagen\|Golf\|2012\|2019\|2.0 TDI` or `universal-fit` | fitting and universal parts match, others do not |
| E-S2 | Base price | any priced part | read `standalone-prices` by `sku` | one EUR/DE and one USD/US price without channel, group or tiers |
| E-S3 | Reseller price | north override exists | price selection with channel `mau-dist-north` | override (a standalone price on the channel); without override the Malva base price |
| E-S4 | No floor | any retail or branch price | verify | any whole-cent amount above 0 passes; zero or negative fails |
| E-S4a | Branch price | a branch has its own price | price selection with the branch channel | branch price; else store channel price; else base price |
| E-S4b | Fit range | Golf 2016 2.0 TDI | finder resolves the key | `Volkswagen\|Golf\|2012\|2019\|2.0 TDI`; year 1999 resolves nothing |
| E-S4c | Subscribable | oil filter, cabin filter, wiper blades | read product | `recurring-eligible` true; the three recurrence policies exist |
| E-S5 | Pre-release | `MLV-BP-41099` | read product | no prices, in master selection only |
| E-S6 | Bundles | diesel kit and a withdrawn component | assortment | bundle absent (workstream F test) |
| E-S7 | Local part | `KW-1001` | read product | no `fitment-keys`, owner store north |
| E-S8 | Idempotent | products seeded | second `seed` | 0 changes |
| E-S9 | Drift | EUR list price changed by hand | `seed` | one `setPrices` update restores it |
| E-S10 | Images blocked | image-source answers 403 | `seed:images` | stops with a message naming OA-03, nothing partial is invalid |
| E-S11 | Images recorded | JSON present | `seed` | images added to the product once, clean URLs |
| E-S12 | Search | seeded, indexing Activated | Product Search for `MLV-BP-41001`, for `Vektra`, for an OE number | the part is found (live, MCP) |

## Browser / MCP recipe

No UI. Claude, through the `b2b2c-automotive` MCP (read only), after E-08:
1. `read_products where key = "mau-part-mlv-bp-41001"`: published, `priceMode` Standalone, no embedded prices, attributes brand `vektra`, quality tier `premium`, `fitment-keys` set (year-range keys), no `map-floor-percent`.
2. `read_standalone_prices where sku = "MLV-BP-41001"`: base EUR/DE and USD/US without channel, plus retail and branch prices on channels; `read_products key = "mau-part-mlv-bp-41099"` and `read_standalone_prices` for that SKU: none.
3. `read_inventory where sku = "MLV-BP-41001"`: warehouse and branch entries.
4. `read_product_projections` with `priceCountry DE`, `priceCurrency EUR`: base price; with `priceChannel <id of mau-dist-north>`: retail price; with a branch channel that has a price: the branch price.
5. `read_product_search`: full text `Vektra`, `MLV-BP-41001`, and a filter on `fitment-keys`; record the facet counts for brand and quality tier, and check that a price facet or sort works with standalone prices.
6. Counts: products 55, standalone prices 220, inventory 209.

## Definition of done

`npm run check` green; E-08 and E-09 done with evidence; every product verify check passes live; Product Search finds parts by part number, brand and OE number; images either recorded (clean URLs, no `?`) or the OA-03 row is open and the storefront placeholder is documented; second `seed` shows 0 changes; no prototype placeholder in the data (test green).

## Evidence to record (in `plans/evidence/E/`)

`npm run check` output; `seed` log for the three steps; MCP excerpts for one part, its standalone prices, the pre-release part, one inventory read, three price selections (base, store channel, branch), the Product Search results with facets; `seed:images` output or the 403 message; a count table (55 products, 220 standalone prices, 209 inventory).

## Questions to the owner (defaults apply until answered)

| ID | Question | Default |
| --- | --- | --- |
| Q-S01 | Fictional brands and synthetic numbers, or real brands? | Fictional |
| Q-S08 | Images from Image source run on an allowed machine, or owner-supplied files? | Image source, once, later |
| Q-S09 | ~~Seed one retail price below the MAP floor for demos?~~ | **Void: no floor exists (Q-T03).** The data contains retail prices below 88 % of the base on purpose |
| Q-S10 | Plate and VIN provider | **Answered Q-002: mock provider only**; in-house vehicle table, no plate or VIN data |
| OA-03 | Image source reachable (or build id supplied) | needed before images |
| OA-04 | Plate and VIN provider decision | only if lookup beyond make, model, year is wanted |

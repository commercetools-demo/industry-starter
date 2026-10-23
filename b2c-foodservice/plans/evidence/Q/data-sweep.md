<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Data sweep and test helpers (Q-04)

Date 2026-10-22. **The live sweep did not run: blocked, owner rows OA-01 and OA-08.** The project planned for Malva Coffee is `spec-test-b2c-food` (OA-01, D-031) and it is the only project the commercetools MCP of this session reaches (OA-06). It has not been seeded yet: there are no Malva API clients in this checkout (`seed/.env` and `storefront/.env.local` hold no live client; they were not read), and the three read-only calls I made show the sample project as it was delivered: the project settings (see the table: the settings OA-08 and OA-A-b ask for are in place), one channel query `key = "mcf-store-nyc-soho"` (**0 results**) and a product count (**117 products**, the sample furniture catalogue such as `Bruno Chair`, no `mcf-` key). Nothing was written; the sample data are cleaned up only by the reviewed manifest (OA-07, OA-S-02), never by hand.

What the sweep proves without a live project is below: the seed data are checked against `SEED-PLAN.md` by 143 tests that run against an in-memory fake of the commercetools API (`cd seed && npm run check`: 12 files, 143 passed, 4 todo, 2026-10-22). The live rows stay open and are the first thing to do after OA-01 (`plans/OWNER-HANDOFF.md`, step 4).

## The seed in numbers (from the seed package, not from a project)

41 products (12 pods, 10 coffee, 8 machines, 8 accessories, 3 gift sets), 115 variants, 805 inventory entries (115 variants x one online entry and six store entries), six stores (`InventorySupply` channels, New York City, US market only), four recurrence policies, three discount codes (`WELCOME10`, `FREESHIP`, `COFFEE15`) and one automatic seasonal product discount, six demo customers (four US, two Canada), 162 reviews on 25 products, 16 products with no reviews.

## Sweep table

`result`: `offline pass` = proven by the named seed test against the in-memory fake; `live: blocked OA-01` = needs the project.

| Section | Check | Offline evidence (test title) | Live |
| --- | --- | --- | --- |
| Project settings | search indexing activated, country tax fallback on | `Project settings > Fresh project`, `plans exactly the actions the platform documents and never removes anything` | **pass** (read-only `read_project`, 2026-10-22): `searchIndexing.productsSearch.status` `Activated`, `carts.countryTaxRateFallbackEnabled` true, `taxRoundingMode` and `priceRoundingMode` `HalfEven`; the owner can mark OA-08 and OA-A-b DONE |
| Countries, currencies, languages | US and CA, USD and CAD, en-US and en-CA | `Project settings > Fresh project` | **pass** (same read): countries GB, DE, US, CA; currencies EUR, GBP, USD, CAD; languages en-GB, de-DE, en-US, en-CA. US and CA are present; GB and DE come with the sample project and are unused (the storefront offers US and Canada only) |
| Tax | US food 0 and standard 8 (NY 8.875), Canada food 0 and GST 5, all tax-exclusive (D-036) | `tax categories follow D-036...`, `Tax by market > US address without state rate`, `uses the food category for pods and coffee and the standard category for machines...` | blocked OA-01 |
| Shipping | two zones, three methods, standard with a free-above tier per currency (75 USD, 99 CAD), collection US only | `two zones and three shipping methods...`, `Shipping by market > Threshold per market` | blocked OA-01 |
| Stores | six stores in New York City with ready time 30 minutes, hours, type | `six stores in New York City as InventorySupply channels...`, `Stores are supply channels > Store list` | blocked OA-01 |
| Types and states | custom types (including `mcf-review`), order states ordered > preparing > ready > collected, no review states (D-037) | `order states chain...`, `review custom type (workstream M) > the mcf-review type has verifiedPurchase and orderNumber...` | blocked OA-01 |
| Catalogue | about 40 products over five product types, 3 or 4 variants where planned; names, descriptions and slugs in en-US and en-CA, unique slugs; category tree with three-language slugs | `about 40 products over the five product types...`, `names, descriptions and slugs exist in en-US and en-CA...`, `categories form the planned tree...`, `five product types with the planned attributes...` | blocked OA-01 |
| Prices | one per market per variant, CAD about 1.37 x USD, recurrence prices 10% below for subscribable products only | `prices: one per market per variant...`, `recurrencePrices: subscribable products get one 10% cheaper price...`, `four recurrence policies with standard schedules` | blocked OA-01 |
| Inventory | online and per store, deterministic, a few zeros and low stock | `stock is deterministic, has a handful of zeros and some low-stock entries...`, `Availability per store > Collect at an empty store` | blocked OA-01 |
| Discounts | the three codes and one automatic discount, unique sort orders | `discounts and codes WELCOME10, FREESHIP and COFFEE15...` | blocked OA-01 |
| Customers | six verified demo customers with addresses, saved list for Maya | `six verified demo customers...`, `every demo account is email-verified...`, `never sends the demo password to be stored...` | blocked OA-01 |
| Reviews | 3 to 12 per top product, none for the others, keys `mcf-review-<sku>-<n>`, statistics match | `Seeded reviews > Statistics match`, `seeds 3 to 12 reviews for each top product...` | blocked OA-01, Q-C-12 (statistics lag) |
| Images | clean URLs (no `?` or `#`) | `Images > URL with query`, `isCleanUrl accepts scheme, host and path only`, `Verification > ... an unclean image URL` | blocked OA-03 (no `images.json` yet) |
| Drift | a changed price, channel field, quantity or tax rate is repaired | `repairs drift: a changed price, a changed channel field...`, `Verification > Drift` | blocked OA-01 |
| Idempotency | second run `0 change(s)` | `Idempotent seed in dependency order > Re-run`, `Partial run`, `review custom type > second run reports 0 changes` | blocked OA-01 (`cd seed && npm run seed` twice, then `npm run verify`) |
| Guards | foreign project key refused, keys all `mcf-`, dry run writes nothing, no credential in the source | `Guards on every script > Mismatched key`, `every script supports --dry-run...`, `contains no real credential, no secret value and every source file has the SPDX header` | n/a |

## Fixtures the journeys use

| Fixture | Value |
| --- | --- |
| Out of stock at one store | store `mcf-store-brooklyn-williamsburg` (Malva Coffee Williamsburg), product codes `POD-EMBER` (Ember Ristretto, SKUs `MCF-POD-EMBER-10`, `-50`, `-100`) and `MAC-POD1` (the `Pod One` machine); both stay in stock online (`seed/src/data/products.ts`, `OUT_OF_STOCK_AT_STORE`). Journey J8 and the L Buy-again step use them. |
| Products with no reviews | 16 products, for example `Velvet Decaf` (`MCF-POD-VELVET-10`): no stars on the card, `Be the first to review` on the page (J5) |
| Subscribable | pods and coffee; a machine has no recurrence price, so `subscribe` on it is 422 `price_unavailable` (J3) |
| Demo customers (keys only) | `mcf-customer-maya`, `-liam`, `-noah` (US), `-priya`, `-lucas`, `-ava` (Canada) |

## Test helpers (Q-04)

`seed:advance-order` and `seed:cleanup-tests` exist (commit `bf8445e5`) with the guards the spec asks for: project key guard and `--confirm` equal to the project key, `--dry-run` that wins over `--apply`, the `@example.com` check for the order's customer, refusal of any key starting `mcf-`, ids only in the output. Their tests (`src/advance-order.test.ts`, `src/cleanup-tests.test.ts`, 25 tests in all) cover the six titles of the task: `advance moves preparing to ready-for-collection`, `advance refuses an order of a non-example customer`, `advance refuses a wrong project key`, `cleanup deletes only registered records`, `cleanup dry run changes nothing`, `cleanup lists orders as not deletable`. Both ran only against the in-memory fake; the live run is owner row M-Q-04 (`seed:cleanup-tests -- --register ../plans/evidence/Q/test-data.md` first as a dry run, read the output, then `--apply --confirm <projectKey>`).

The storefront journeys here ran against the local mock, which keeps records in memory; `test-data.md` lists them. The `purge-plan.txt` of the script (dry run against the live project) could not be produced for the same reason: owner row M-Q-04.

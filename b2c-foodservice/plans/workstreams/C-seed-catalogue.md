<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream C: Seed catalogue (products, prices, recurring prices, inventory, images, discounts, customers, lists, reviews, verify)

## 1. Header

| Field | Value |
| --- | --- |
| ID | C |
| Name | Seed catalogue: review, extend, live-run and verify the catalogue and people data of the Malva Coffee project |
| Depends on | B (`Done`: foundation seeded live, second run `0 change(s)`, evidence in `plans/evidence/B/`) |
| Wave | 2 (parallel with D and E) |
| Branch | `ws/c-seed-catalogue`; commit `ws-C: C-12 <summary>` |
| Primary spec | `openspec/specs/platform-project-setup-and-seed/spec.md` (continued from B: seeded order, Images, Verification; B is primary and owns the scenario list, C owns the four scenarios named in section 5) |
| Also served | `reviews-and-ratings` (requirement "Seeded reviews", scenario "Statistics match"; M is primary), `fulfilment-and-availability-model` (data half of "Availability per store" and "Subscriptions": per-store stock, recurring prices) |
| Generated templates that apply | none |
| Owner prerequisites | **OA-01** (live runs), **OA-03** (image source, images only; a 403 blocks images but nothing else). New rows drafted in `plans/notes/todo-C.md`: `OA-x` (demo password hand-over), `SO-x` (compatibility wording), `M-C-01` |
| Skills to load first | `commercetools-platform` (`product-search.md`), `commercetools-commerce-patterns` (`customer-group-pricing.md` is not used; read `discount-fundamentals.md`, `cart-discount-scenarios.md`, `high-precision-money.md`), `commercetools-catalog-migration` (`product-model.md`, `pricing-and-money.md`, `categories-and-slugs.md`), `commercetools-storefront` (`references/core/optional/recurring-prices.md`) |

## 2. Goal and scope

**Context.** Same package as B (`seed/`), written by another agent from `plans/SEED-PLAN.md`, never run live. C is the junior-facing work for the catalogue half: review it against the spec and `SEED-PLAN.md` sections 8 to 16, close gaps with tests, run it live in small steps, and prove with read-backs that everything the storefront workstreams (F to O) need is present.

**Goal.** After C: 41 published products (12 pods, 10 coffees, 8 machines, 8 accessories, 3 gift sets, 115 variants) with names and descriptions in en-US, en-GB and de-DE; embedded prices for US/USD, DE/EUR, GB/GBP on every variant and recurring prices for subscribable products; 805 inventory entries (online plus six stores per variant); 3 cart discounts with 3 codes and 1 product discount; 6 verified demo customers and one saved-items list; review states and 162 approved reviews whose statistics match; images on products and categories once OA-03 allows; `npm run verify` prints `verify: OK`; a second `npm run seed` prints `0 change(s)`.

**In scope**
- Review of `src/data/{products,catalog,prices,extras,discounts,customers,reviews,states}.ts`, `src/images.ts`, `src/verify.ts`, `src/seed.ts` (steps `products`, `prices`, `inventory`, `discounts`, `customers`, `shopping-lists`, `review-states`, `reviews`).
- Extra tests, an optional `verify -- --search` probe (Q-C-11), live runs, read-backs, evidence.

**Out of scope**: the foundation steps (B), any storefront code, orders and carts (the seed never creates them), choosing real photos (the owner's endpoint, OA-03), real German copywriting beyond what the seed contains (SO-03/SO-04 reviews).

**Hard safety rules**: as in B section 2. Additionally: demo customer passwords come only from `SEED_DEMO_PASSWORD` in `seed/.env.local`; never print, log or put it in evidence; customer e-mails are synthetic `@example.com` and may appear in evidence only as the count (not necessary at all). Never delete anything in C (no cleanup, no reset).

## 3. Design

### 3.1 Live run order (only this order)

All from `cd seed`. B must be `Done`. Each step is idempotent; a step can be repeated.

| # | Command | Expected |
| --- | --- | --- |
| 1 | `npm run check` | green offline |
| 2 | `npm run seed -- --dry-run --offline` | the whole plan for an empty project, ends `N change(s)` |
| 3 | `npm run seed -- --dry-run` | reads the live project; the foundation steps show nothing to do; catalogue steps show creations |
| 4 | `npm run seed -- --only products` | 41 `create product ...` lines (published) |
| 5 | `npm run seed -- --only prices` | one `update prices of product ...` line per product |
| 6 | `npm run seed -- --only inventory` | 805 `create inventory ...` lines |
| 7 | `npm run seed -- --only discounts` | 1 product discount, 3 cart discounts, 3 codes |
| 8 | `npm run seed -- --only customers,shopping-lists` | 6 customers (+ `verify email` lines if needed), 1 list. Needs `SEED_DEMO_PASSWORD` (at least 10 characters) |
| 9 | `npm run seed -- --only review-states,reviews` | 2 review states, 162 reviews |
| 10 | `npm run seed` | `0 change(s)` |
| 11 | `npm run verify` | `verify: OK` (if the review statistics lag, wait one minute and run it again; section 3.7) |
| 12 | `npm run seed:images -- --dry-run`; after OA-03 `npm run seed:images`; then `npm run seed` | images recorded; the seed run changes only product images and category assets; a further `npm run seed` reports `0 change(s)`; `npm run verify` is `OK` |

Wait for Product Search indexing before probing search (a few minutes; creating products is incremental indexing: https://docs.commercetools.com/api/projects/product-search#index-updates).

### 3.2 What each catalogue step sends

| Step | Resource and SDK call | Create / update actions | Docs |
| --- | --- | --- | --- |
| `products` | `products()` `.post` (`ProductDraft`: `key`, `productType` and `taxCategory` by key, localized `name`, `slug`, `description`, `categories` by key, `masterVariant` and `variants` with `sku`, `key`, `attributes`, optional `images` `{ url, dimensions }`, `searchKeywords`, `publish: true`) | updates `setName`, `setDescription`, `setAttribute`, `addExternalImage`, `removeImage`, `publish` | https://docs.commercetools.com/api/projects/products |
| `prices` | `products().withId().post` | `setPrices` per variant with embedded `PriceDraft` `{ key, value, country, recurrencePolicy? }` (recurring prices are prices that carry a `recurrencePolicy` reference and come back in `variant.recurrencePrices[]`; the SDK 8 type of `PriceDraft` lacks `recurrencePolicy`, the API accepts it: see the docs example `addPrice` with `recurrencePolicy`) | https://docs.commercetools.com/api/projects/products#set-prices , https://docs.commercetools.com/guides/create-a-recurring-order#set-up-pricing |
| `inventory` | `inventory()` `.post` | `InventoryEntryDraft { key, sku, quantityOnStock, supplyChannel? }`; update `changeQuantity` | https://docs.commercetools.com/api/projects/inventory |
| `discounts` | `productDiscounts()`, `cartDiscounts()`, `discountCodes()` | product discount `value relative 1500`, `predicate sku in (...)`; cart discounts `requiresDiscountCode: true`, `stackingMode: 'Stacking'`; codes reference cart discounts by key; updates `changeIsActive`, `changeSortOrder`, `changePredicate`, `changeCartPredicate`, `changeName` | https://docs.commercetools.com/api/projects/productDiscounts , https://docs.commercetools.com/api/projects/cartDiscounts , https://docs.commercetools.com/api/projects/discountCodes |
| `customers` | `customers()` `.post`, then `customers().emailToken().post` and `customers().emailConfirm().post` for any unverified account | `CustomerDraft` with `key`, `password` (from env), addresses, default shipping and billing | https://docs.commercetools.com/api/projects/customers |
| `shopping-lists` | `shoppingLists()` `.post` | `ShoppingListDraft` `mcf-saved-maya` with three line items by SKU | https://docs.commercetools.com/api/projects/shoppingLists |
| `review-states` | `states()` (type `ReviewState`) | `mcf-review-approved` with role `ReviewIncludedInStatistics`, `mcf-review-pending` (no role, transition to approved) | https://docs.commercetools.com/guides/review-ratings#review-approval-process |
| `reviews` | `reviews()` `.post` | `ReviewDraft { key, uniquenessValue, authorName, title, text, rating, locale, target (product by key), state (approved), customer? }`; updates `setRating`, `setTitle`, `setText`, `setState`/transition | https://docs.commercetools.com/api/projects/reviews , https://docs.commercetools.com/guides/review-ratings |

Rating statistics (https://docs.commercetools.com/guides/review-ratings#display-one-product): `reviewRatingStatistics.averageRating` (rounded to 5 decimals), `count`, `ratingsDistribution` (keys `"1"` to `"5"`; a missing key means zero) on the product.

### 3.3 Expected end state (read counts from the data files, trust them over this table if they differ)

| Resource | Expected |
| --- | --- |
| Products | 41, all published, keys `mcf-...`; by product type `mcf-pods` 12, `mcf-coffee` 10, `mcf-machine` 8, `mcf-accessory` 8, `mcf-gift-set` 3; 115 variants; each product has name and description in `en-US`, `en-GB`, `de-DE`; SKUs `MCF-...` unique |
| Prices | per variant one one-time price for each of US/USD, DE/EUR, GB/GBP (EUR about 0.92 and GBP about 0.79 of USD, rounded to 5 cents); subscribable products also carry, for each of the four policies, a recurring price per market at 10% below that market's one-time price; embedded price keys like `us-one-time`, `de-every-month`. Expected number of price entries: `npx tsx -e "import('./src/data/prices.ts').then(m=>console.log(m.allPriceDefs().length))"` |
| Inventory | 805 entries = 115 variants x (1 online without channel + 6 store channels); online quantity 40 to 499 (never zero); store quantity 0 for 1 in 20, 1 to 5 (low, threshold 5) for 1 in 7, else 6 to 65; products `POD-EMBER` and `MAC-POD1` are 0 at `mcf-store-munich` and in stock online |
| Product discount | `mcf-discount-seasonal-machines`: 15% off, predicate on the SKUs of three machines (`MAC-POD1`, `MAC-LEVER`, `MAC-DRIP`), active |
| Cart discounts and codes | `mcf-discount-welcome10` (10% total price), `mcf-discount-freeship` (100% shipping), `mcf-discount-coffee15` (15 off when the cart is at least 60 USD, 55 EUR or 50 GBP); codes `WELCOME10`, `FREESHIP`, `COFFEE15` |
| Customers | 6: `maya.okonkwo@example.com`, `liam.carter@example.com` (US), `anna.schneider@example.com`, `jonas.weber@example.com` (DE), `emma.clarke@example.com`, `oliver.hughes@example.com` (GB); `isEmailVerified: true`, one default shipping and billing address each |
| Shopping list | `mcf-saved-maya`, 3 line items, customer Maya |
| Review states | `mcf-review-pending`, `mcf-review-approved` (role `ReviewIncludedInStatistics`) |
| Reviews | 162 keyed `mcf-review-<sku>-<n>`, 3 to 12 per top product, none for three products, all `includedInStatistics: true`; per product `reviewRatingStatistics.count` equals the seeded count and `averageRating` equals the seeded mean (tolerance 0.001) |
| Images | After OA-03: product variants carry `images[0].url` clean (no `?`, no `#`) with dimensions; categories carry `assets[0].sources[0].uri` clean; the file `seed/src/data/images.json` is committed |

### 3.4 Read-back (no owner needed)

Prefer the commercetools MCP read tools (OA-06). Otherwise a throwaway read-only script (not in git, not in `check`) with these SDK calls:

| Check | Call |
| --- | --- |
| Product count and publication | `apiRoot.products().get({ queryArgs: { limit: 1, withTotal: true, where: 'key in (...)' } })` or `productProjections().get({ queryArgs: { where: 'key = "<k>"', priceCurrency: 'USD', priceCountry: 'US', expand: ['productType'] } })` |
| One projection in a market | `apiRoot.productProjections().withKey({ key }).get({ queryArgs: { priceCurrency: 'EUR', priceCountry: 'DE' } })`; check `masterVariant.price`, `masterVariant.recurrencePrices.length` (12 for a subscribable product: 3 markets x 4 policies; confirm and write the actual number into the evidence), `masterVariant.attributes` contains `badge` and `subscribable`, `reviewRatingStatistics` |
| Inventory | `apiRoot.inventory().get({ queryArgs: { where: 'sku = "<sku>"' } })`: 7 entries; the `supplyChannel` ids resolve to the six `mcf-store-*` channels |
| Discounts | `cartDiscounts().withKey().get()`, `discountCodes().get({ queryArgs: { where: 'code in ("WELCOME10","FREESHIP","COFFEE15")' } })` |
| Reviews per product | `apiRoot.reviews().get({ queryArgs: { where: 'target(typeId="product" and id="<id>") and includedInStatistics=true', limit: 100 } })`: `total` equals `reviewRatingStatistics.count` |
| Product Search (indexing works) | `apiRoot.products().search().post({ body: { query: { exact: { field: 'variants.sku', value: '<sku>' } }, limit: 1, productProjectionParameters: { priceCurrency: 'USD', priceCountry: 'US' } } })`; and a rating range `{ query: { range: { field: 'reviewRatingStatistics.averageRating', gte: 4.5 } }, limit: 5 }` (documented: https://docs.commercetools.com/api/projects/product-search#filter-by-review-rating , sort at `#sort-by-review-ratings`). Use `docs-search.mjs` of the platform skill to confirm any field name you are unsure of; never invent one |

Product Search finding to write down (feeds Q-024 and workstream G): the docs list `reviewRatingStatistics.averageRating`, `count`, `highestRating`, `lowestRating` as filterable and sortable in Product Search. If the probe returns results, record "no fallback attribute needed" in `plans/PROJECT-FINDINGS.md`; if it errors, record the error and tell the lead.

### 3.5 Evidence (`plans/evidence/C/`, no secrets, no personal data)

`check.txt`, `scenario-map.md`, `offline-plan.txt` (the plan-by-step table and total), `live-1-products.txt` ... `live-9-reviews.txt` (command outputs, counts only), `seed-second-run.txt` (`0 change(s)`), `verify-ok.txt`, `readback-products.json` (key, published, variant count), `readback-prices-sample.json` (3 products: prices per market and `recurrencePrices` count), `readback-inventory-sample.json` (one product, 7 entries), `readback-discounts.json`, `readback-reviews.json` (per product: seeded count, `reviewRatingStatistics.count`, `averageRating`), `search-probe.json`, `images.txt` (or `blocked: OA-03`), `image-<n>-375.png` and `image-<n>-1440.png` (browser recipe), `README.md`.

### 3.6 Review checklist (what to compare)

| Area | Compare with | Check |
| --- | --- | --- |
| Product counts and mix | `SEED-PLAN.md` section 8 | 12 pods (6 original, 6 vertuo; variants 10, 50, 100 capsules), 10 coffees (250 g, 1 kg crossed with grinds), 8 machines (colour crossed with bundle), 8 accessories, 3 gift sets; 3 products without reviews; 2 products out of stock at one store |
| Words | decision D-005 | pods are described as "compatible with Nespresso Original" or "Vertuo", never use Nespresso as a product name or brand; no real third-party brand (denylist test) |
| Languages | spec Project settings | name, description and slug in en-US, en-GB, de-DE; en-GB uses British spelling (colour) where the text differs |
| Slugs | skill `categories-and-slugs.md` | slugs are unique per language across products; no umlaut or space |
| Images in drafts | D-010 and spec Images | URLs clean; dimensions set; no image attached when the file is missing |
| Prices | `SEED-PLAN.md` section 9, D-017 | numbers as 3.3; the US amount is net, DE and GB gross: the **tax category** on every product decides the rate (food or standard) |
| Recurring prices | skill `recurring-prices.md` | only for `subscribable` products; policy by key; 10% below the one-time price of the same market; they come back in `recurrencePrices[]` |
| Inventory | `SEED-PLAN.md` section 11, spec fulfilment "Availability per store" | deterministic from SKU and store key; online entry without channel; store entries with `supplyChannel`; low threshold 5 |
| Discounts | `SEED-PLAN.md` section 12 | codes and amounts; `sortOrder` unique and not ending in 0 (platform rule); predicates valid (the API validates them on create: a 400 `InvalidInput` means fix the predicate against https://docs.commercetools.com/api/predicates/cart-predicates); `FREESHIP` currently applies to any shipping method (Q-C-5) |
| Customers | `SEED-PLAN.md` section 13 | six, verified, default addresses; password only from env; synthetic data |
| Reviews | spec reviews "Seeded reviews", "Moderation and states" | 3 to 12 per top product, rating skew 5/7/13/30/45 percent for 1 to 5 stars, language of the author's market, each demo customer at most once per product (platform `uniquenessValue`), approved state with the statistics role |
| Verify | spec "Verification" | exits 1 on any mismatch; reports a hand-edited price by SKU |

### 3.7 When a response differs

Same procedure as B section 3.7 (stop, finding row in `plans/PROJECT-FINDINGS.md`, fix seed-code defects with a failing test first, re-run: idempotent). Likely differences:

| Symptom | First action |
| --- | --- |
| 400 `DuplicateField` on `slug` | Slugs are unique per language: find the colliding product, change the slug in the data file (with a test), re-run |
| 400 `InvalidField` on a price draft mentioning `recurrencePolicy` | Compare with the docs `addPrice` example; try `setPrices` with `recurrencePolicy` by `id` instead of `key` (resolve via `keyOf`); record the finding |
| 400 `InvalidInput` on a cart discount predicate | Fix the predicate against the cart predicate docs; the offline fake cannot validate predicates, so add a note and a test that pins the corrected string |
| 400 `DuplicateField` on a sort order | Make the `sortOrder` unique across the kind (value in (0,1), not ending in 0) |
| 400 `ReferenceDoesNotExist` | A prerequisite step is missing; run it (see B) |
| 400 `DuplicateField` on a customer e-mail | A sample customer with that e-mail exists: it should have been in the cleanup manifest; tell the lead (do not delete) |
| Review statistics `count` below the seeded count | Statistics update asynchronously; wait one minute, run `verify` again; after 10 minutes record a finding |
| 403 | Add the scope the error names via `OA-x` (B1) |
| 429 | Wait a minute, re-run |
| Image source 403 | Expected possibility: the script stops with the OA-03 message; **never** try to get around it (spec "Blocked source"); mark the images tasks `blocked: OA-03` and continue |

## 4. Tasks

Run `cd seed && npm run check` before ticking a code task. `[SKILL]` tags on every task that touches commercetools.

- [ ] **C-01 Baseline and reading** `[SKILL: commercetools-platform]`
  - Files: `plans/evidence/C/check.txt`.
  - Confirm B is `Done`. `cd seed && npm run check` saved. Read `src/seed.ts` steps `products` to `reviews`, `src/data/products.ts`, `prices.ts`, `extras.ts`, `discounts.ts`, `customers.ts`, `reviews.ts`, `catalog.ts`, `images.ts`, `verify.ts`. Run the counting one-liners: `npx tsx -e "import('./src/data/products.ts').then(m=>console.log(m.PRODUCTS.length, m.allVariants().length))"`.

- [ ] **C-02 Scenario map** `[SKILL: commercetools-platform]`
  - Files: `plans/evidence/C/scenario-map.md`.
  - Same method as B-02 for section 5 (the four scenarios plus the seeded-reviews scenario). Existing tests found while planning: `URL with query`, `Blocked source`, `Later images` (`images.test.ts`), `Drift` (`verify.test.ts`), `Statistics match` (`reviews.test.ts`), `Re-run` and `Partial run` (`seed.test.ts`).

- [ ] **C-03 Review product data** `[SKILL: commercetools-catalog-migration]`
  - Files: `seed/src/data/products.ts`, `seed/src/data.test.ts` (shared with B).
  - Compare with the checklist rows "Product counts and mix", "Words", "Languages", "Slugs". Add tests: `Product counts by type are 12, 10, 8, 8 and 3`, `Every product has name, description and slug in en-US, en-GB and de-DE`, `Slugs are unique per language`, `Nespresso appears only in compatibility wording` (every occurrence is preceded by "compatible with " or "Kompatibel mit " or "kompatibel mit " or "Compatible with " or followed by the disclaimer phrase), `No product name contains a denylisted brand` (denylist: Nespresso, Illy, Lavazza, Starbucks, Nescafe, Keurig, Dolce Gusto, Tassimo, Delonghi, De'Longhi, Breville), `SKUs are unique and start with MCF-`, `Three products have no reviews and two are out of stock at one store`.

- [ ] **C-04 Review prices** `[SKILL: commercetools-commerce-patterns]`
  - Files: `seed/src/data/prices.ts`, `seed/src/data.test.ts`.
  - Tests: `Every variant has one-time prices for US USD, DE EUR and GB GBP`, `EUR is about 0.92 and GBP about 0.79 of USD rounded to 5 cents`, `Recurring prices exist only for subscribable products and are 10 percent below the one-time price for every policy`, `Price keys are unique per variant`, `Amounts are positive integers`, `Every product has a tax category: food for pods and coffee, standard for the rest`.

- [ ] **C-05 Review inventory** `[SKILL: commercetools-platform]`
  - Files: `seed/src/data/extras.ts`, `seed/src/data.test.ts`.
  - Tests: `One online entry and six store entries per variant (805)`, `Online stock is never zero`, `Collect at an empty store: POD-EMBER and MAC-POD1 are 0 at Munich and in stock online` (data half of the fulfilment scenario), `Some entries are low stock (1 to 5) and some are 0`, `Quantities are the same on every call`.

- [ ] **C-06 Review discounts** `[SKILL: commercetools-commerce-patterns]`
  - Files: `seed/src/data/discounts.ts`, `seed/src/data.test.ts`.
  - Check the predicate syntax of `COFFEE15` (`lineItemTotal(true) >= "60.00 USD" or ...`) and the product discount predicate (`sku in (...)`) in the predicate docs; the live run validates them. Tests: `Three codes exist: WELCOME10, FREESHIP, COFFEE15`, `Sort orders are unique per kind and do not end in 0`, `Cart discounts need a code and stack`, `COFFEE15 has one amount per currency`, `The seasonal discount targets only machine SKUs that exist`.

- [ ] **C-07 Review customers and the list** `[SKILL: commercetools-platform]`
  - Files: `seed/src/data/customers.ts`, `seed/src/seed.test.ts`.
  - Tests: `Six demo customers, two per market, all with example.com e-mail`, `Every demo customer is verified, also one created unverified earlier`, `Customers get default shipping and billing addresses`, `The demo password is read from the environment and never logged` (exists in `seed.test.ts`: confirm), `The saved list has three line items by SKU that exist`.

- [ ] **C-08 Review reviews and states** `[SKILL: commercetools-platform]`
  - Files: `seed/src/data/reviews.ts`, `seed/src/data/states.ts`, `seed/src/reviews.test.ts`.
  - Tests (spec: Seeded reviews): `Seeded reviews: 3 to 12 per top product and none for three products`, `Statistics match` (exists), `Reviews are written in the language of the author's market`, `A customer reviews a product at most once` (the draft carries `uniquenessValue` so the platform enforces it), `Approved state carries ReviewIncludedInStatistics and pending does not`.

- [ ] **C-09 Review images** `[SKILL: commercetools-platform]`
  - Files: `seed/src/images.ts`, `seed/src/data/catalog.ts`, `seed/src/images.test.ts`.
  - Tests (spec: Images): `URL with query` (exists: `https://host/p/1.jpeg?auto=compress&w=1440` stores `https://host/p/1.jpeg`; this is also workstream A's second half of "Stored URL with a query"), `Blocked source` (exists), `Later images` (exists), plus `Seed without images.json succeeds and attaches nothing`, `images.json is read when present and is not git-ignored`, `Every stored image URL in a product or category draft is clean`. The complete invented fixture is `seed/src/fixtures/image-source.json`; `sample-data/image.json` is truncated and is never parsed.

- [ ] **C-10 Optional: `verify -- --search` probe** `[SKILL: commercetools-platform]`
  - Files: `seed/src/api.ts` (add optional `searchProducts(body)`), `seed/src/fake-api.ts` (simple fake), `seed/src/verify.ts`, `seed/src/verify.test.ts`.
  - Default (Q-C-11): `npm run verify -- --search` additionally runs the three read-only Product Search probes of 3.4 and fails (exit 1) when the SKU probe finds nothing or the total is below 41; the rating-range probe is **reported**, not enforced (finding for G). Without `--search` nothing changes. Test: `Search probe passes with a fake that answers` and `Search probe fails when the SKU is not found`.

- [ ] **C-11 Pre-live gate** `[SKILL: commercetools-platform]`
  - Files: `plans/evidence/C/offline-plan.txt`.
  - B is `Done` (read `plans/evidence/B/seed-foundation-2.txt`). `npm run check` green. `npm run seed -- --dry-run --offline` saved. `seed/.env.local` has `SEED_DEMO_PASSWORD` of at least 10 characters (generate locally without printing: `printf 'SEED_DEMO_PASSWORD=%s\n' "$(openssl rand -base64 18)" >> seed/.env.local`). `IMAGE_SOURCE_URL` is not needed yet.
  - Blocked: **OA-01**.

- [ ] **C-12 Live: products** `[SKILL: commercetools-platform]`
  - Files: `plans/evidence/C/live-1-products.txt`, `readback-products.json`.
  - Commands 3 and 4 of 3.1. Read back (3.4): 41 products, all published, 115 variants, three locales present; save key, published, variant count only.

- [ ] **C-13 Live: prices and inventory** `[SKILL: commercetools-commerce-patterns]`
  - Files: `live-2-prices.txt`, `live-3-inventory.txt`, `readback-prices-sample.json`, `readback-inventory-sample.json`.
  - Commands 5 and 6. Read back three products (one pod subscribable, one machine on seasonal sale, one accessory): prices per market, `recurrencePrices` count, discounted price on the seasonal machine (a projection with `priceCurrency` and `priceCountry` shows `price.discounted`), inventory 7 entries, the Munich zero entries. Expected price entry count from 3.3.

- [ ] **C-14 Live: discounts, customers, list** `[SKILL: commercetools-platform]`
  - Files: `live-4-discounts.txt`, `live-5-customers.txt`, `readback-discounts.json`.
  - Commands 7 and 8. Read back: 3 codes active, 6 customers verified (count only), the list has 3 lines. Check no output contains the password.

- [ ] **C-15 Live: review states and reviews** `[SKILL: commercetools-platform]`
  - Files: `live-6-reviews.txt`, `readback-reviews.json`.
  - Command 9. For each product with reviews compare `reviewRatingStatistics.count` and `averageRating` with `expectedStats` (use `npm run verify` and the throwaway read); wait and retry per 3.7 if lagging. The three products without reviews have no statistics or `count` 0.

- [ ] **C-16 Live: full run, verify, search probe** `[SKILL: commercetools-platform]`
  - Files: `seed-second-run.txt`, `verify-ok.txt`, `search-probe.json`.
  - Commands 10 and 11 (and `verify -- --search` if C-10 is done, else the manual probes of 3.4). Write the Product Search finding into `plans/PROJECT-FINDINGS.md`.

- [ ] **C-17 Live: images (OA-03)** `[SKILL: commercetools-platform]`
  - Files: `images.txt`, browser evidence, `seed/src/data/images.json` (committed when produced).
  - `npm run seed:images -- --dry-run` (prints the request). If OA-03 is done: `npm run seed:images`; on HTTP 403 or a non-JSON answer the script stops with the OA-03 message: write `blocked: OA-03` in `images.txt`, tell the lead, mark this task blocked and finish C without images. If recorded: `npm run seed` (only images and category assets change, `Later images`), then `npm run seed` again (`0 change(s)`), `npm run verify`. Run the browser recipe.

- [ ] **C-18 Evidence and hand-off**
  - Files: `plans/evidence/C/README.md`, `plans/STATUS.md` row C.
  - One line per evidence file; list what is blocked (OA-03) and what the downstream workstreams can rely on (counts of 3.3, the SKU of three sample products, the market keys). Set `Ready for review`.

## 5. Scenarios checklist

Owned by C (from `platform-project-setup-and-seed`):
- [ ] URL with query: `URL with query` in `seed/src/images.test.ts` (also closes A's "Stored URL with a query")
- [ ] Blocked source: `Blocked source` in `seed/src/images.test.ts` + live `images.txt` (or `blocked: OA-03`)
- [ ] Later images: `Later images` in `seed/src/images.test.ts` + live second image run
- [ ] Drift: `Drift` in `seed/src/verify.test.ts` (a hand-edited price is reported by SKU and exits 1)

Shared with B (tested by the same package, listed in B): Re-run (`Re-run` after the catalogue steps), Partial run (`Partial run`: `--only products,prices` without prerequisites).

Extended from other specs:
- [ ] `reviews-and-ratings` Seeded reviews / Statistics match: `Statistics match` in `seed/src/reviews.test.ts` + live `readback-reviews.json`
- [ ] `fulfilment-and-availability-model` Collect at an empty store (data half): `Collect at an empty store: POD-EMBER and MAC-POD1 are 0 at Munich and in stock online` + `readback-inventory-sample.json`
- [ ] `fulfilment-and-availability-model` Subscriptions (data half): `Recurring prices exist only for subscribable products...` + `readback-prices-sample.json` (`recurrencePrices` present)

## 6. Browser recipe (Chrome DevTools MCP, you run it)

C has no pages. The only visual check is that the recorded image URLs really load (skip with `blocked: OA-03` if no images). Load the tools with ToolSearch. Evidence in `plans/evidence/C/`.
1. Read three URLs from `seed/src/data/images.json` (one coffee, one capsule, one machine; first, middle, last).
2. `resize_page` 1440x900; `navigate_page` to each URL; `take_screenshot` `image-<n>-1440.png`; `list_network_requests`: 200 and an `image/*` content type; `list_console_messages`: no error. Repeat at 375x812 for `image-<n>-375.png`.
3. Confirm the URL shown in the address bar has no `?` and no `#` (clean) and that the image is reachable without cookies (a fresh page).
4. If the storefront (A, D) is running and D's `image-config` exists, open the same image through `transformListingImageUrl` once (optional) and note the resized result.
5. `README.md` line per file.

## 7. Self-verification with data

Section 3.3 (expected) against 3.4 (read-back) is the verification, in this order of preference: the commercetools MCP read tools; a throwaway read-only SDK script; `npm run verify` (and `-- --search`). Everything the owner could be asked ("are there 41 products?") is answered by a read-back saved in `plans/evidence/C/`. Compare numbers with the data files, not with this document, if they differ, and say so in `README.md`.

## 8. Manual testing and owner items

| ID | Who | When needed | Steps (summary) | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-01 (existing) | Owner | C-12 onwards | Seed client in `seed/.env.local` | live dry run connects | TODO |
| OA-03 (existing) | Owner | C-17 only | Provide `IMAGE_SOURCE_URL` that answers scripted requests, or supply `seed/src/data/images.json` | `seed:images` records clean URLs | TODO |
| OA-x (C1) | Owner | Before the first manual login test (J onwards) | Read the demo password from `seed/.env.local` (`SEED_DEMO_PASSWORD`) on your own machine; never paste it in chat; or replace it in the file and ask the lead to re-run `seed -- --only customers` | You can sign in as `maya.okonkwo@example.com` once J exists | TODO |
| SO-04 (existing) | Owner | Before release | Review the invented catalogue | Approval | TODO |
| SO-x (C1) | Owner or legal | Before release | Approve the compatibility wording ("Compatible with Nespresso Original machines (not affiliated with Nespresso)") used in product and category texts (D-005) | Approval or replacement wording | TODO |
| M-C-01 | Owner | Optional, after C-18 | Merchant Center: Products list shows 41 products with images (after OA-03) and prices in three currencies; one product shows reviews and an average rating | Matches `plans/evidence/C/README.md` | TODO |

Full rows in `plans/notes/todo-C.md`.

## 9. Questions (default is built)

| ID | Question | Default | Blocks |
| --- | --- | --- | --- |
| Q-C-1 | If OA-03 stays blocked: ship without images? | Yes: products and categories without images; the storefront shows neutral placeholders (E token `canvas-2`); the seed adds images on a later run | no |
| Q-C-2 | Where does the demo password come from? | `SEED_DEMO_PASSWORD` in `seed/.env.local`, generated locally; the owner reads it from the file (OA-x C1) | J |
| Q-C-3 | Guest-style reviews 7 to 12 per product have no customer and a synthetic author (`Sam T.`). | Accepted (Q-S-4); they cannot be edited by anyone | no |
| Q-C-4 | "Verified purchase" marks need orders linked to reviews; the seed creates none. | No verified marks in the seed; K or Q may create test orders later | M |
| Q-C-5 | `FREESHIP` applies to any shipping method (predicate `true`). Restrict to standard shipping? | As seeded (collect is free anyway); revisit after K | no |
| Q-C-6 | EUR and GBP prices: derived (0.92, 0.79, rounded to 5 cents) or supplied? | Derived; the owner may supply a table (replaces `FX`) | no |
| Q-C-7 | Pack and size variants. | Pods 10, 50, 100 capsules; coffee 250 g and 1 kg crossed with grinds; as seeded | no |
| Q-C-8 | Which two products are out of stock at which store? | `POD-EMBER` and `MAC-POD1` at `mcf-store-munich` | no |
| Q-C-9 | Low-stock threshold. | 5 in the seed (`LOW_STOCK_THRESHOLD`); the storefront reads the same value from a constant in `lib/utils.ts` defined by H (not hard-coded in components) | H |
| Q-C-10 | Which products are subscribable? | All pods and coffees (Q-006), none of the others | N |
| Q-C-11 | Add a `verify -- --search` probe (C-10)? | Yes, optional flag; rating probe reported only | no |
| Q-C-12 | Review statistics lag after creating reviews. | `verify` is re-run after one minute; a finding after 10 minutes | no |
| Q-C-13 | Review language on the product page: show all languages or only the shopper's? | Show all (M decides); seed provides all three | M |
| Q-C-14 | Publish at creation. | Yes (`publish: true`); staged equals current | no |
| Q-C-15 | Disclaimer text "not affiliated with Nespresso" in every pod description. | Keep (SO-x C1 for approval) | no |
| Q-C-16 | Recurring price write path (a price carrying `recurrencePolicy`, not typed in SDK 8). | As seeded; a live difference is recorded as a finding | no |

Also in `plans/notes/questions-C.md`.

## 10. Definition of done

- C-01 to C-18 ticked (C-17 may end `blocked: OA-03`; everything else must be done); each code task has a passing `cd seed && npm run check` commit.
- Section 5 scenarios each have the named test or evidence; `plans/evidence/C/scenario-map.md` exists.
- Live: `npm run seed` prints `0 change(s)` and `npm run verify` prints `verify: OK`; read-backs match 3.3 (or each difference is a written finding); Product Search probe saved and the finding about rating filter and sort written.
- Evidence contains no password, no secret and no personal data; `grep -r "SEED_DEMO_PASSWORD\|SECRET" plans/evidence/C` prints nothing.
- Images: either recorded and clean (`images.json` committed) or `blocked: OA-03` stated in the evidence README and in `STATUS.md`.
- Rows in `plans/TODO-MANUAL-TESTING.md` (lead merges `plans/notes/todo-C.md`), questions in `plans/QUESTIONS.md`, findings in `plans/PROJECT-FINDINGS.md`.
- `node plans/verify-plan.mjs` passes; `STATUS.md` row C is `Ready for review`.

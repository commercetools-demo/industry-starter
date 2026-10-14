<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream T: Portal catalog (assortment, price overrides, product info and images, discounts)

Status: DRAFT v2 (2026-10-12, owner answers folded in). Letters and dependencies: `plans/DEPENDENCY-PLAN.md`. `sp/` = `b2b2c-automotive/openspec/specs/seller-portal/`. Paths are relative to `b2b2c-automotive/` unless they start with `plans/`.

Owner decisions applied in this version (source: `plans/notes/owner-answers.md`, "owner interview 2026-10-12"): Q-003 all prices are standalone prices (Malva base price too); Q-005 branch channels carry inventory and prices (per-branch editing is U); Q-T03 **no MAP floor**, a reseller may set any price above zero; Q-T06 tailored text and tailored images publish at once, no approval; Q-004 no review gate; Q-V01 wholesale buying from Malva is out of scope (no price lists, no contract pricing, no dependency on the old workstream V); roles are Admin and Buyer only (no Approver). **Contract with the seed (`seed/`, source of truth, not edited from here):** selections `mau-sel-malva-master` (the master pool, assigned to no store), `mau-sel-north`, `mau-sel-south` (assigned and active on `mau-reseller-north` and `mau-reseller-south`); one custom object `mau-assortment/<storeKey>` per store (`withdrawnByReseller`, `blockedUpstream`, `preRelease`, `pendingReview`); standalone price keys `<sku>__base-eur-de`, `<sku>__base-usd-us`, `<sku>__<channelKey>`, `<sku>__<channelKey>__usd`; a store's distribution channels are its retail channel (`mau-dist-north`, `mau-dist-south`) plus its branch channels; there is **no wholesale cost price, no `malva-dach-approved` selection, no price floor and no customer group**, so T has no "Your cost" column and no margin or below-cost logic. Data T needs and the seed lacks is listed in section "Seed requests" and in `plans/notes/seed-requests.md`.

## 1. Goal

The "Catalog & pricing" area of the portal (`/[locale]/catalog/...`, six tabs) lets a reseller Admin:

1. choose which Malva master parts its storefront sells (assortment) and see that the change reaches the storefront;
2. set its own retail price per part as a **standalone price on the store's distribution channel**, with information on how far it is from the Malva list price, validated on the server (above zero, two decimals, store currency); there is no price floor;
3. tailor how a part is presented (name, description, **images**); tailoring is **published at once**, with no review;
4. run its own product and cart discounts and rank them, with Malva-funded promotions locked at the top.

Buyer sees the same tabs read-only. Gate to pass: **G9 after T**: a reseller price override above zero is accepted and shows in PLP, PDP and cart, a zero or negative price is rejected by the server; assortment changes show in the storefront; tailored text and image appear at once (Chrome plus MCP).

## 2. Depends on

| Workstream | Needed | How to check |
| --- | --- | --- |
| E | 48 master parts (47 priced, one pre-release `MLV-BP-41099` with no price), 2 Malva kits, 4 reseller-local parts, 3 bundles in all; **every price a standalone price** (Malva base price: no channel, EUR/DE and USD/US, keys `<sku>__base-eur-de`, `<sku>__base-usd-us`; reseller retail and branch prices on channels); product types `mau-pt-part` (attribute `oem-numbers` for OE search), `mau-pt-local-part`, `mau-pt-bundle` | MCP `read_products`, `read_standalone_prices` (data contract, section 5) |
| F | Stores `mau-reseller-north` and `mau-reseller-south`, each with its retail distribution channel plus branch channels (distribution and supply), selections `mau-sel-malva-master`, `mau-sel-north`, `mau-sel-south`, custom objects `mau-assortment/<storeKey>`, discounts `mau-pd-*`, `mau-cd-*` incl. Malva-funded ones, demo associates (Admin and Buyer) | MCP `read_stores`, `read_product_selections`, `read_custom_objects`, `read_product_discounts`, `read_cart_discounts` |
| R | Shell, `authorizeStore`, `sessionFor`, `expectCrossStoreForbidden`, role matrix (Admin, Buyer), Copilot registry (`registerCopilotAction`), `check-routes` that demands a `*.cross-store.test.ts` for every `app/api/seller/**` handler | `npx vitest run lib/authz lib/portal` green |
| G | `admin-client.ts`, env validation, `scopes.ts`, `.env.example` check | `npm run check` green |
| U (soft) | `lib/contentools/jwt.ts` for image upload (T-08). Not required to start: T builds behind an interface and records a TODO row if U is not finished | `ls portal/lib/contentools/jwt.ts` |
| L, M (soft, for G9 browser step) | Storefront listing and product pages reading the store's assortment, prices and tailored images | `plans/workstreams/L-*.md`, `M-*.md` exist and are done |

If a seed object in section 5 is missing, do **not** edit `seed/`: add a row to `plans/notes/seed-requests.md` (columns workstream, what, why) and to this file's "Seed requests" section, build against the documented shape, and record the gap in Notes. Never write to the project by hand or through MCP write tools.

## 3. Specs and requirement ids implemented

1. `sp/design-catalog-assortment/spec.md`
   - Authority chain is visible
   - Assigned products table
   - Local products
   - Assortment changes are safe
2. `sp/design-price-overrides-and-margin/spec.md`
   - One price per part per reseller store
   - Margin feedback: **reduced** (no cost price exists after Q-V01 and the seed has none): only the informational "{n}% below/above Malva list price"; no margin chip, no "below cost" confirmation
   - Price floor from Malva: **dropped by the owner (Q-T03)**; replaced by "any price above zero"; the spec file is not edited here, the plan override is recorded in `plans/DECISIONS.md`
   - Order of price layers
   - Bulk editing and safe publish (the preview flags invalid results only: zero or negative; no floor and no cost case)
3. `sp/design-product-info-tailoring/spec.md`
   - Tailor presentation fields only
   - Fallback and reset
   - Content review before publishing: **dropped by the owner (Q-T06, Q-004)**; tailoring publishes at once
   - Localisation
   - Image replacement scope (images are tailored per store, publish at once; the "requirement of review" is dropped, the format and size limits stay)
4. `sp/design-discounts-and-priority/spec.md`
   - Discount lists
   - Order of application
   - Priority within a kind
   - Promo codes visible with reasons
   - Safe discounts (reduced to validation: ranges and schedule; no floor and no below-cost logic)
   - Editor for rules

Also from `sp/bootstrap-and-structure/spec.md`: "As-associate for buying, admin client for selling" (every write here goes through `app/api/seller/**` and `authorizeStore`) and "Gates and tests" (a cross-store test for every seller route).

Spec gaps closed here: bulk selection, search, category filter and sort in the assortment table; line-level (category) assign and withdraw; discount editors; bulk percentage and CSV price edits with preview. Not built (stays a gap): price scheduling, currency columns, price history, audit trail. Per-branch prices are **not** in T: U's branch screens write them with T's helper `setStandalonePrice` (Contract for V and W, section 5b).

## 4. Decisions already taken

| # | Decision | Source |
| --- | --- | --- |
| 1 | Assortment is product selections (seed names): `mau-sel-malva-master` (the master pool: every master part and Malva kit, assigned to no store, never written by T), and one `Individual` selection per reseller, `mau-sel-north` or `mau-sel-south` (read from `store.productSelections` of the session store, never built from the store key), active on the reseller store. The reseller's own items (local parts, own bundles) live only in its selection. There is no `malva-dach-approved` selection: "approved for DACH" is the master pool minus `blockedUpstream`. | spec "Platform notes"; `design.md` decision 1 and open question E (one store per reseller); `seed/src/data/assortment.ts` |
| 2 | "Never widen" is enforced by the portal server: an assign is refused (409 `BLOCKED_UPSTREAM`) unless the part is in `mau-sel-malva-master` **and** not listed in `mau-assortment/<storeKey>.blockedUpstream`, or is the store's own item (product type `mau-pt-local-part` or `mau-pt-bundle` with `owner-store` = the store key and, for a local part, `review-state` `approved`). commercetools does not enforce it. | spec "Confirm how never widen is enforced"; default recorded in Q-T05 |
| 3 | Withdrawn-by-reseller state and upstream-block reasons live in the seed's custom object, container `mau-assortment`, key `<storeKey>` (one object per store): `withdrawnByReseller: { sku, reason }[]` (T writes it on withdraw and reinstate, touching only this array and keeping the other fields as they are), `blockedUpstream: { sku, by, reason }[]` (Malva-written, T reads only; for example `MLV-HL-56002` by "Malva DACH", "No type approval for road use in Germany"), `preRelease: sku[]`, `pendingReview: sku[]` (T reads only). Written with the admin client. | Q-T05; `seed/src/data/assortment.ts` |
| 4 | Local items are products of type `mau-pt-local-part` (seed keys `mau-local-<sku>`, W-created `local-<storeKey>-<sku>`) and own bundles of type `mau-pt-bundle`, recognised by the attribute `owner-store` = the store key (never by key prefix); they are created only by seed or workstream W (product import, bundles); T displays and withdraws them. A local part with `review-state` `pending` (listed in `pendingReview`, kept out of the selection) shows as "Awaiting Malva review" with no action; `rejected` shows nothing to assign. | spec "Local products"; W scope; `seed/src/data/product-types.ts` |
| 5 | **Price model (Q-003, owner): all prices are standalone prices**, one per SKU, currency and country. Malva list price: standalone price with no channel and no customer group, EUR with country DE (key `<sku>__base-eur-de`) and USD with country US (key `<sku>__base-usd-us`); T reads it by `sku`, currency and "channel not defined". Reseller override: standalone price scoped to the reseller store's distribution channel (retail channel `mau-dist-north` or `mau-dist-south`), written with the **seed key scheme**: `<sku>__<channelKey>` for EUR (country DE) and `<sku>__<channelKey>__usd` for USD (country US), helper `standalonePriceKey(sku, channelKey, currency)` identical to the seed's `channelPriceKey` (a test compares the output with the seeded keys for the same inputs, for example `MLV-BP-41001__mau-dist-north`). A store sells in EUR; the south store also sells in USD for country US, so the price table offers a EUR/USD switch only for a store whose `countries` include US. Price selection prefers the channel-scoped price over the base one, so an absent override means the Malva list applies. There is **no cost price** (wholesale buying is out of scope, Q-V01; the seed has none), so no "Your cost" column. Confirm with the knowledge MCP how product projections and Product Search consume standalone prices (price selection with currency, country and channel; price facets and price sort on standalone prices) before building T-05; record the finding in Notes. | Q-003; Q-T01, Q-T02; reference `b2b2c-starter/dealer/lib/ct/standalone-prices.ts` |
| 6 | **No price floor (Q-T03, owner).** There is no `lib/rules/map-floor.ts`, no `computeFloor`, no `assertAboveFloor`, no `BELOW_MAP_FLOOR`, no `malva-rules` object and no `map-floor-percent` attribute use. A price write is valid when it is `{ type: 'centPrecision', currencyCode = store currency, centAmount: integer > 0, fractionDigits: 2 }`; anything else is `INVALID_MONEY` (400). The "% below Malva list price" figure is shown as information only (no limit, no warning tone). The module is `lib/rules/price-money.ts` with `assertValidPrice({ price, currency })` throwing `RuleViolation({ code: 'INVALID_MONEY' })`. | Q-T03 |
| 7 | **No suspension or reconcile of prices** (it existed only for the floor). | Q-T03 |
| 8 | **No margin chips and no below-cost confirmation** (there is no cost price, decision 5). Feedback is informational only: "{n}% below Malva list price" or "{n}% above" next to the price input, neutral tone. | spec "Margin feedback" (reduced); Q-V01 |
| 9 | Order of price layers shown verbatim: "Malva price → your override → product discounts → cart discounts". Product discounts: only the highest-ranked matching one applies; cart discounts stack unless stopped. | spec; skill `commercetools-commerce-patterns` `discount-fundamentals.md` |
| 10 | **Tailoring publishes at once (Q-T06, Q-004).** Tailoring uses commercetools Product Tailoring in the reseller store. A save writes the staged changes and publishes in the same update request (`publish` action after the field actions, or `publish: true` on the draft when creating; confirm names with `commercetools-oas-schemata` `api-ProductTailoring-write`). There is no pending state, no approve or reject, no review queue, no `scripts/review-tailoring.mjs`. Reset deletes the store's tailoring for that product. | Q-T06 |
| 11 | Tailorable fields: `name`, `description` (localised, per store language) and **`images` of the master variant**. Everything else (SKU, fitment, specs, slug) is rejected by a strict schema. | spec "Tailor presentation fields only"; Q-T06 |
| 12 | Tailored images: added by **upload through the Contentools `upload-file` endpoint** (`POST {CONTENTOOLS_ORIGIN}/service/{storeKey}/upload-file`, clean URL saved) **or by pasting an image URL**. Limits: JPG, PNG or WebP, at least 600 x 600 px, at most 10 MB, https only for pasted URLs (the server fetches the URL once to validate bytes, with a timeout and a size cap, and refuses private network addresses). Images can be added, removed and reordered (first image is the primary image). | Q-T06, Q-T08, Q-U01 |
| 13 | Discounts of a store (`belongsToStore`): product discounts created by T carry the store's distribution channel in the predicate (`channel.id = "<id>"`); the seeded reseller product discounts (`mau-pd-north-*`, `mau-pd-south-*`) are recognised by the key `mau-pd-<north\|south>-` of the session store (product discounts have no custom fields); cart discounts whose `stores` contains the store key or whose custom field `storeKey` (type `mau-cart-discount-fields`) equals it. **Malva-funded** = product discount key starts `mau-pd-malva-`; cart discount custom field `fundedBy = 'malva'` (this also covers W's co-op discounts); they apply to every store, show locked at the top, and cannot be changed, activated or deleted by a reseller (403 `LOCKED_MALVA_FUNDED`). Every cart discount T creates sets the type `mau-cart-discount-fields` with `fundedBy: 'reseller'` and `storeKey`, and `stores: [store]`. | spec "Order of application"; reference `b2b2c-starter/dealer/lib/ct/discount-access.ts`; `seed/src/data/discounts.ts` |
| 14 | sortOrder: higher fires first (confirmed live in T-00, constant `SORT_HIGHER_FIRST` in `lib/catalog/sort-order.ts`; if the platform answers the other way the constant flips and the bands mirror). Portal rank 1 = highest sortOrder. Malva-funded discounts must hold values above every reseller value (band 0.90 to 0.99); reseller discounts hold 0.05 to 0.89. Generated values never end in 0 (commercetools rejects that), are unique per kind, and re-ranking permutes the store's own values (no collisions). The seed currently uses Malva 0.11 and reseller 0.51 to 0.53 (Q-S05): seed request, see "Seed requests". | spec "Platform notes"; skill sortOrder rule; reference `dealer/lib/ct/discount-layout.ts` |
| 15 | Discounts are created inactive and unscheduled ("New cart rule (draft)"). The preview is a local evaluation of the structured rule on a sample cart; an acceptance script proves it matches commercetools for an active discount. | spec "Discount lists", "Editor for rules" |
| 16 | Safe discounts (reduced, Q-T03): a rule is valid when relative percent is 0.01 to 100, an absolute amount is above zero, and the schedule is `from < until`. There is no cost price, so no below-cost warning, no floor check and no `lib/rules/discount-band.ts`. Where a discount would reduce a price to or below zero the platform clamps it; we do not invent a limit. | spec "Safe discounts" (floor and cost parts dropped); Q-T03 |
| 17 | Withdraw always asks for confirmation (count plus open-cart impact); assign and reinstate never do. | spec "Assortment changes are safe"; plan decision |
| 18 | Every seller endpoint takes `storeKey` explicitly (query for GET, body for writes) and `authorizeStore` compares it with the session before any commercetools call. | `sp/bootstrap-and-structure` scenario "Cross-store write" |
| 19 | Prices are edited in one currency at a time: EUR (country DE) by default, and USD (country US, key suffix `__usd`) for a store whose `countries` include US (Q-010: USD and US for en-US). Side-by-side currency columns stay a gap. | spec Gaps; Q-010 |
| 20 | Assortment, price and tailoring changes reach the storefront within the storefront's cache lifetime; the portal does not call the storefront. Assumed lifetime 60 seconds. | Q-T07 |
| 21 | Branch channels carry stock and prices (Q-005). T edits the **store distribution channel** price only; a branch price is a standalone price on the branch channel, written by U through `setStandalonePrice(storeKey, sku, branchChannelKey, cents)`. Price selection order in the storefront (L, M, N): branch channel price if a branch is selected and has one, else the store channel price, else the Malva base price. | Q-005, Q-I04 |
| 22 | Roles: Admin and Buyer only (Q-V01 removed the Approver role with the wholesale specs). | Q-V01 |

## 5. Data contract (what must exist in commercetools; read back in section 12)

| Thing | Key or shape | Owner |
| --- | --- | --- |
| Selections | `mau-sel-malva-master` (no store), `mau-sel-north` (store `mau-reseller-north`, 43 products), `mau-sel-south` (store `mau-reseller-south`, 42 products), Individual mode; the reseller selection is read from the store's active `productSelections` | F |
| Store | `mau-reseller-north` / `mau-reseller-south` with `distributionChannels` = the retail channel (`mau-dist-north`, `mau-dist-south`, first) plus the store's branch channels, `supplyChannels` = warehouse plus branches, `countries`, `languages`, custom type `store-settings` (`currency`) | F |
| Malva list price | standalone price, no channel, no group: `<sku>__base-eur-de` (EUR, DE) and `<sku>__base-usd-us` (USD, US); none for the pre-release part | E |
| Cost price | **does not exist** (wholesale out of scope) | none |
| Retail override | standalone price on the store's retail distribution channel, key `<sku>__<channelKey>` (EUR, DE) or `<sku>__<channelKey>__usd` (USD, US); the seed already holds such prices for about half of the carried parts, and owner-only items (local parts, own bundles) have only this price | E (seeded), T (written) |
| Branch price | standalone price on a branch channel (also a distribution channel of the store), same key scheme with the branch key | E (seeded), U (written through T's helper) |
| Tailoring | Product Tailoring in store `<storeKey>` (name, description, variant images), published; 5 seeded (`mau-tl-<north\|south>-<sku>`, 3 north, 2 south, three with images) | E / T |
| Discount keys | Malva-funded: product `mau-pd-malva-*`, cart `custom.fundedBy = malva`; reseller: seed `mau-pd-<north\|south>-*`, `mau-cd-<north\|south>-*`, T-created `<storeKey>-<slug>-<random4>` | F / T |
| Custom objects | `mau-assortment/<storeKey>` (fields in decision 3) | F (seeded), T (writes `withdrawnByReseller` only) |

Task T-00 verifies each row; a failing row is fixed in the seed before feature work.

### 5b. Contract for V and W (and U, L, M)

| Export | Signature | Used by |
| --- | --- | --- |
| `lib/ct/seller/prices.ts` `getRetailPrice` | `getRetailPrice(storeKey, sku, channelKey?, currency?): Promise<{ centAmount; currencyCode } \| null>` (override on the channel, else Malva base price; `null` for a pre-release part) | W bundles, W campaigns |
| `lib/ct/seller/prices.ts` `setStandalonePrice` | `setStandalonePrice(storeKey, sku, channelKey: string \| undefined, centAmount \| null, currency = 'EUR')`; `channelKey` defaults to the store's retail distribution channel and must be that channel or one of the store's branch channels; the key is `<sku>__<channelKey>` (EUR) or `<sku>__<channelKey>__usd` (USD) and the country DE or US follows the currency; `null` deletes the price; validates with `assertValidPrice`; the only writer of standalone prices (single-writer test) | T routes, U branch screens, W (bundle and local product price) |
| `lib/ct/seller/assortment.ts` `isAssigned` | `isAssigned(storeKey, sku): Promise<boolean>` | W bundles |
| `lib/ct/seller/assortment-write.ts` `assignProducts`, `withdrawProducts` | as in T-03; after withdraw and reinstate, W calls its `reconcileBundles` (W edits the routes it names, T leaves a hook `onAssortmentChanged(storeKey)` array) | W |
| `lib/catalog/sort-order.ts` `allocateSortOrder` | `allocateSortOrder(kind, held, band: 'reseller' \| 'malva-funded'): string` (the `malva-funded` band 0.9 to 0.99 is used by W for co-op discounts, created with `custom.fundedBy = malva`) | W campaigns |
| `lib/ct/seller/discounts.ts` | `createCartDiscountDraft` helpers and `lib/discounts/code-status.ts` `codeStatus` | W, N |
| **Removed** | `lib/rules/map-floor.ts` (`computeFloor`, `assertAboveFloor`, `floorPermyriad`), `lib/rules/discount-band.ts`, `BELOW_MAP_FLOOR`, `reconcileMapFloor`, the tailoring review queue, `reviewTailoring`, `scripts/review-tailoring.mjs`, `malva-rules/map-floor`, `portal-tailoring-review`, `portal-assortment/*` (replaced by the seed's `mau-assortment/<storeKey>`), `malva-dach-approved`, `malva-wholesale` and every cost, margin and `BELOW_COST` item | W (bundles, campaigns, partnership), X |

Storefront image selection contract (for L and M, edited by another agent): for a product in store S the primary image and gallery are, in this order, (1) the images of the published Product Tailoring of the store S for the master variant (via the in-store product projection of S, which already merges tailoring), (2) the master variant images. Product Search results and PLP cards use the same rule (first image of that list). A tailored image never changes SKU, fitment or availability. L and M must read through the in-store projection and must not read tailoring separately; add a test with a store that has a tailored image and one that has none.

## 6. Server-side price validation (explicit and testable)

There is no price floor. What the server still guarantees:

| # | Control | Behaviour | Test |
| --- | --- | --- | --- |
| E1 | Single writer | `lib/ct/seller/prices.ts` is the **only** module that may call `standalonePrices()` write methods; `PUT /api/seller/prices`, `POST /api/seller/prices/bulk` and `POST /api/seller/prices/import` all call its `publishPrices()`, which calls `setStandalonePrice` | `lib/ct/seller/prices.single-writer.test.ts` greps `app/` and `lib/` |
| E2 | Server owns the facts | `publishPrices` loads the Malva list price itself; any `list`, `cost` or `currency` in the request body is refused (strict zod schema rejects unknown keys with 400) | `prices.test.ts` > `refuses client supplied list, cost and currency` |
| E3 | Validate all, then write | For every change: part must be in the store assortment (422 `NOT_IN_ASSORTMENT`), must have a list price (422 `PRICE_PENDING`), money must pass `assertValidPrice` (store currency, `centPrecision`, integer above 0, two fraction digits). If any change is invalid, **zero** writes and 422 or 400 with `violations: [{ sku, attemptedCents, code }]` | `prices.test.ts` > `one invalid row rejects the whole batch with zero writes` |
| E4 | Order of checks | `authorizeStore` (403) before any commercetools call; then validation (400/422); then count confirmation (409 `CONFIRMATION_REQUIRED` unless `confirm: true` and `expectedCount === changes.length`) | `prices.test.ts` order tests |
| E5 | Discounts | Saving or activating a discount runs `validateRule` (decision 16): ranges and schedule | `lib/catalog/discount-rule.test.ts` |
| E6 | Out of band edits | Merchant Center edits are allowed; nothing reconciles them (no floor exists) | n/a |

Fixture values: price 0, negative, 90.005 (3 decimals), another currency, `highPrecision` money: all `INVALID_MONEY`; 0.01 passes.

## 7. Assortment-to-storefront propagation (explicit and testable)

Mechanism: the storefront lists and opens parts through the store-scoped Product Search (`POST /in-store/key={storeKey}/products/search`), which only returns products in the store's active selections. Therefore **the portal's only job is to change the reseller selection correctly**.

| Step | Action | Proof |
| --- | --- | --- |
| P1 | `POST /api/seller/assortment/withdraw` removes the products from the store's selection (`mau-sel-north` or `mau-sel-south`, `removeProduct` actions) and records them in `mau-assortment/<storeKey>.withdrawnByReseller` | MCP `read_product_selection_assignments` or `read_product_selections` shows the product gone; custom object shows it withdrawn |
| P2 | commercetools indexes the change (eventually consistent, normally seconds) | `scripts/verify-assortment-propagation.mjs <storeKey> <sku> absent` polls the in-store Product Search every 5 s up to 90 s and exits 0 only when the SKU is gone (and `present` for assign) |
| P3 | Storefront cache lifetime (assumed 60 s, Q-T07) | Chrome: storefront listing and product pages for the store no longer show the part after at most 2 minutes; the second reseller's storefront still shows it |
| P4 | Reinstate or assign adds it back | same three proofs in the opposite direction |
| P5 | Upstream withdrawal | `reconcileAssortment(storeKey)` removes from the reseller selection any part that is in `mau-assortment/<storeKey>.blockedUpstream` (or no longer in `mau-sel-malva-master`) and is not the store's own item; run on the catalog page load for Admin and by `scripts/reconcile-assortment.mjs <storeKey>` |

If the storefront shows a stale part after 5 minutes, the fault is the storefront cache (workstream L or M); record it in Notes and in `plans/notes/questions-RSTU.md` as a follow-up, do not add a webhook from the portal.

## 8. Role matrix for this workstream

| Capability | Admin | Buyer |
| --- | --- | --- |
| Open Catalog & pricing tabs, read lists | yes | yes (read-only) |
| Assign, withdraw, reinstate | yes | no (button disabled, "Insufficient permissions to perform this task"; `POST` 403) |
| Edit and publish prices, bulk edit, import | yes | no |
| Tailor product info and images, reset | yes | no |
| Create, edit, toggle, rank discounts | yes | no |

Permission actions to add to R's table in `lib/authz/permissions.ts`: `catalog.view` (Admin, Buyer), `catalog.edit`, `price.edit`, `tailoring.edit`, `discount.edit` (Admin only).

## 9. Tasks

Test-first: for every task write the named tests of section 10, watch them fail, implement, then run `cd b2b2c-automotive/portal && npm run check`.

### T-00 Preflight and data contract

1. R is done; `npx vitest run lib/authz lib/portal` is green.
2. Read in the skills: `commercetools-commerce-patterns` `references/discount-fundamentals.md`, `limited-time-pricing.md`, `customer-group-pricing.md` (price selection), and `commercetools-storefront` `references/b2b/product-listing.md` (store, channels, price injection) and `references/b2b/add-api.md`.
3. Confirm the data contract (section 5) with the MCP reads of section 12, items 1 to 4. Never fix gaps in `seed/`: add a row to `plans/notes/seed-requests.md` (see "Seed requests").
4. Run the sortOrder band check (T-09 provides the script; until then read `read_product_discounts` and `read_cart_discounts` and confirm every Malva-funded discount (decision 13) has a sortOrder above every reseller discount of its kind). Also confirm the sortOrder direction with the documentation (Knowledge MCP `commercetools-documentation-search`, "sortOrder" of ProductDiscount and CartDiscount) and set `SORT_HIGHER_FIRST` accordingly; record the finding in Notes.
5. Conventions from G and C: `apiRoot` is the frontend client, `adminRoot` the admin client (`lib/ct/admin-client.ts`; in this file "admin client" and snippets that show `apiRoot...` for seller operations mean `adminRoot`); route helpers `handle`, `ApiError`, `parseJson`, `requireBusinessUnit` are in `lib/api.ts`; `getSession()` in `lib/session.ts`; scopes are documented in `lib/scopes.ts` as `{ scope, reason }`.
6. Add the admin client scopes with a reason each to `portal/.env.example` and `portal/lib/scopes.ts`: product selections (manage), products (view, to read master data), standalone prices (manage), product tailoring (manage), product discounts (manage), cart discounts (manage), discount codes (manage), orders or carts (view, for open-cart impact), key-value documents (manage, state objects). Determine each exact scope string from the docs with the Knowledge MCP tool `commercetools-documentation-search` for the resource (do not guess); `scopes.test.ts` and `check-secrets` must pass. Scope creation by the owner is row OA-12 (section 13).

### T-01 Pure domain modules (no I/O) [SKILL: commercetools-commerce-patterns]

Files under `lib/catalog/` with tests next to them:

- `assortment-state.ts`:

```ts
export type AssortmentState = 'inherited' | 'local' | 'available' | 'withdrawn' | 'pre-release' | 'blocked-upstream' | 'pending-review';
export interface Membership { inMaster: boolean; blockedUpstream: boolean; inReseller: boolean; withdrawnByReseller: boolean; preRelease: boolean; pendingReview: boolean }
export function deriveState(m: Membership): AssortmentState;
export const STATE_UI: Record<AssortmentState, { tone: 'success'|'info'|'neutral'|'warning'|'critical'; actionKey: 'withdraw'|'assign'|'reinstate'|'cantReadd'|'none' }>;
```

Membership is computed from the three seed sources: `inMaster` from `mau-sel-malva-master`, `inReseller` from the store selection, and `blockedUpstream`, `withdrawnByReseller`, `preRelease`, `pendingReview` from `mau-assortment/<storeKey>` (SKU lists). Rules: not in master and in `pendingReview`: `pending-review`; not in master and in reseller: `local` (own local part or own bundle); not in master and withdrawn: `withdrawn`; in master and `blockedUpstream`: `blocked-upstream` (action disabled); in master and in reseller: `inherited`; in master, not in reseller, withdrawn flag: `withdrawn`; in master, not in reseller, `preRelease`: `pre-release`; else `available` (for example the exhaust parts the north store never added). Table from the spec: Inherited success "Withdraw here", Local addition info "Withdraw here", Available neutral "Assign", Withdrawn by you warning "Reinstate", Pre-release info "Assign", Blocked upstream critical "Can't re-add" (disabled), Awaiting Malva review neutral, no action.

- `margin.ts`: only `belowListPercent(priceCent, listCent)` (and its above counterpart) for the informational "{n}% below Malva list price" text (never a warning tone). There is no margin chip function: no cost price exists (decision 8).
- `lib/rules/price-money.ts` (decision 6): `assertValidPrice({ price, currency })` and `lib/rules/to-response.ts` mapping `RuleViolation` to `{ error: { code, message } }`.
- `sort-order.ts`: `allocateSortOrder(kind, held: Set<string>, band: 'reseller' | 'malva-funded'): string` (random 10 digits in 0.05 to 0.89 for `reseller`, 0.90 to 0.99 for `malva-funded`, last digit 1 to 9, retry on collision; `held` is read from the project because values are unique per kind across the whole project, seeded ones included; constant `SORT_HIGHER_FIRST` mirrors the bands when the platform ranks the other way) and `rankToSortOrders(orderedIds: string[], currentValues: Map<string,string>): Map<string,string>` assigning the store's existing values sorted descending to ids in rank order.
- `discount-rule.ts`: structured model and `compileProductDiscount(rule, channelId)`, `compileCartDiscount(rule, storeKey)`, `describeRule(rule, locale)` (plain language, "−3% on carts of €2,000 or more"), `previewRule(rule, sampleCart)`, `validateRule(rule)` (decision 16; there are no customer groups, so no customer-group condition):

```ts
export type ProductScope = { kind: 'all' } | { kind: 'category'; categoryId: string; label: string } | { kind: 'skus'; skus: string[] };
export type CartCondition = { kind: 'always' } | { kind: 'cartTotalAtLeast'; centAmount: number } | { kind: 'category'; categoryId: string };
export type Effect = { kind: 'relative'; percent: number } | { kind: 'absolute'; centAmount: number } | { kind: 'freeShipping' };
export interface ProductRule { name: Record<string,string>; scope: ProductScope; effect: Exclude<Effect,{kind:'freeShipping'}>; validFrom?: string; validUntil?: string }
export interface CartRule { name: Record<string,string>; condition: CartCondition; effect: Effect; stacking: 'Stacking' | 'StopAfterThisDiscount'; code?: string; validFrom?: string; validUntil?: string }
```

Compile examples (use exactly these shapes):

```json
// product discount, 8% off category brakes, store channel clause (channel.id) appended
{ "key": "mau-reseller-north-brakes8-k3f9", "name": {"de-DE":"Bremsen -8%","en-US":"Brakes -8%"},
  "value": {"type":"relative","permyriad":800},
  "predicate": "categories.id contains any (\"<categoryId>\") and channel.id = \"<distributionChannelId>\"",
  "sortOrder": "0.4172835961", "isActive": false }
// cart discount, -3% total on carts >= 2000.00 EUR
{ "key": "mau-reseller-north-cart3-x2p8", "name": {"de-DE":"Warenkorb -3%","en-US":"Cart -3%"},
  "value": {"type":"relative","permyriad":300}, "target": {"type":"totalPrice"},
  "cartPredicate": "totalPrice >= \"2000.00 EUR\"", "stores": [{"typeId":"store","key":"mau-reseller-north"}],
  "custom": {"type":{"typeId":"type","key":"mau-cart-discount-fields"},"fields":{"fundedBy":"reseller","storeKey":"mau-reseller-north"}},
  "stackingMode": "Stacking", "requiresDiscountCode": false, "sortOrder": "0.3318264957", "isActive": false }
// free shipping: target {"type":"shipping"}, value relative permyriad 10000
```

Predicates are built from validated fields only (ids and SKUs are checked against `^[A-Za-z0-9_-]+$`); never concatenate free text into a predicate; use `var.` predicate variables when querying with user input.

### T-02 Catalog reads (server) [SKILL: commercetools-commerce-patterns]

File `lib/ct/seller/assortment.ts` (admin client; imported only from `app/api/seller/**`):

```ts
export interface AssortmentRow { productId: string; productKey: string; sku: string; name: string; listPrice: Money | null; state: AssortmentState; reason: string; }
export async function listAssortment(storeKey: string, q: { state?: 'all'|'assigned'|'available'|'blocked'; text?: string; categoryId?: string; offset: number; limit: number }): Promise<{ rows: AssortmentRow[]; total: number; assigned: number; totalMaster: number }>;
export async function getChain(storeKey: string): Promise<{ masterCount: number; approvedCount: number /* master minus blockedUpstream */; resellerCount: number; branchCount: number }>;
export async function assortmentImpact(storeKey: string, productIds: string[]): Promise<{ count: number; openCartCount: number; branches: number }>;
/** True when the SKU's product is in the store's own selection (assigned). Used by W (bundles) as COMPONENT_NOT_ASSIGNED guard. */
export async function isAssigned(storeKey: string, sku: string): Promise<boolean>;
```

`isAssigned` is exported from this module on purpose: workstream W (bundles) imports it. Test: `assortment.test.ts` > `isAssigned is true for an assigned SKU, false for withdrawn, available, blocked and unknown SKUs and for another store's parts`.

- Membership sets come from `GET /product-selections/key=mau-sel-malva-master/products?limit=500&offset=N` and the same for the store's selection (key read from the store's active `productSelections`, so `mau-sel-north` for `mau-reseller-north`), paged and cached in memory for 30 s per `selectionId + version`; the state lists come from one read of the custom object `mau-assortment/<storeKey>`. Cap rows at `ASSORTMENT_ROW_CAP = 5000` and say so in the UI when hit.
- Row base = `mau-sel-malva-master` members, plus the store selection's non-master members (local parts, own bundles), plus the SKUs of `withdrawnByReseller` and `pendingReview` that are not in a selection.
- Hydrate only the visible page: `apiRoot.productProjections().get({ queryArgs: { where: 'id in (:ids)', 'var.ids': pageIds, staged: false } })` (one call, not per row).
- Reasons: blocked upstream reason from `mau-assortment/<storeKey>.blockedUpstream[].reason` with `by` as the source (for example "Malva DACH: No type approval for road use in Germany"); withdrawn by reseller shows its stored `reason` or "Withdrawn by you"; inherited from Malva DACH; pre-release from `preRelease`; "Awaiting Malva review" from `pendingReview`.
- Open carts: admin `carts().get({ queryArgs: { where: 'cartState="Active" and store(key=:s) and lineItems(productId in :ids)', 'var.s': storeKey, 'var.ids': chunk, limit: 500 } })` per chunk of 100, union of cart ids.
- The chain card text (business unit chain `mau-bu-malva` > `mau-bu-malva-dach` > reseller > branch units): "Malva Global → Malva DACH → {Reseller} → Branches" with counts (master pool, approved = master minus blocked, reseller selection, branch channels); the reseller node reads "You · edits this level"; branches "Inherit from you" (branch channels carry their own stock and prices, edited in Store & channels, U); note "Each level can narrow or add, never widen what its parent withdrew."

### T-03 Assortment writes [SKILL: commercetools-commerce-patterns]

`lib/ct/seller/assortment-write.ts`:

```ts
export async function assignProducts(storeKey, productIds): Promise<{ added: number }>;      // 409 BLOCKED_UPSTREAM if any id is in mau-assortment blockedUpstream, or not in mau-sel-malva-master and not the store's own approved item
export async function withdrawProducts(storeKey, productIds, c: { confirm: boolean; expectedCount: number }): Promise<{ removed: number }>;
export async function reconcileAssortment(storeKey): Promise<{ removed: string[] }>;
export const onAssortmentChanged: Array<(storeKey: string) => Promise<void>>; // hook for W (bundles); T calls them after assign, withdraw and reconcile
```

Update request (chunks of 100 actions per call; on 409 `ConcurrentModification` re-read the selection and retry with the **latest** version, never the failed one):

```
POST /product-selections/{id}
{ "version": 12, "actions": [
  { "action": "addProduct", "product": { "typeId": "product", "id": "<productId>" } },
  { "action": "removeProduct", "product": { "typeId": "product", "id": "<productId>" } } ] }
```

Withdraw requires `confirm: true` and `expectedCount === (await assortmentImpact(...)).count`, else 409 `CONFIRMATION_REQUIRED` with the impact. Withdraw and assign update `mau-assortment/<storeKey>.withdrawnByReseller` (read the object first, change only that array, write back with its version, retry on conflict; every other field is kept). Assign of a pre-release part is allowed ("Price pending" on the storefront).

Routes (each with `storeKey`, `authorizeStore` first, and a `*.cross-store.test.ts`):

| Route | Purpose |
| --- | --- |
| `GET /api/seller/assortment?storeKey=&state=&text=&categoryId=&offset=&limit=` | table rows plus counts ("{n} of {total} master products assigned") |
| `GET /api/seller/assortment/chain?storeKey=` | chain card |
| `POST /api/seller/assortment/impact` `{ storeKey, productIds }` | counts for the confirmation dialog |
| `POST /api/seller/assortment/assign` `{ storeKey, productIds }` | assign or reinstate |
| `POST /api/seller/assortment/withdraw` `{ storeKey, productIds, confirm, expectedCount }` | withdraw |
| `POST /api/seller/assortment/reconcile` `{ storeKey }` | P5 |

"Select all N matching the filter" sends `filter` instead of `productIds`; the server resolves the ids itself (same filter code) and applies the same confirmation. Category (line-level) assign or withdraw uses this path.

### T-04 Assortment UI [SKILL: commercetools-storefront]

Pages under `app/[locale]/(portal)/catalog/`: `layout.tsx` (page header, chain card, six tabs in this order: Assigned products, Price overrides, Product info, Product discounts, Cart discounts, Discount priority; tabs 40 px, radius 8), `page.tsx` (assigned products). Table min width 820 px with horizontal scroll; filters All, Assigned, Available, Blocked upstream; search box; category filter; row checkboxes with the kit's sticky bulk bar; chips per `STATE_UI`; "Price pending" for a part without list price (never 0). Withdraw opens a confirmation dialog naming the count, "open carts affected", and "Branches lose it as well, and storefront listings stop showing it." Blocked upstream shows the reason and a disabled "Can't re-add". Buyer: actions disabled with `INSUFFICIENT`.

### T-05 Price reads and the price table [SKILL: commercetools-commerce-patterns]

`lib/ct/seller/prices.ts` reads:

```ts
export interface PriceRow { sku: string; productId: string; name: string; listCent: number | null; overrideCent: number | null; belowListPercent: number | null }
export async function listPrices(storeKey: string, q: { text?: string; currency?: 'EUR' | 'USD'; offset: number; limit: number }): Promise<{ rows: PriceRow[]; total: number; currency: string }>;
export async function getRetailPrice(storeKey: string, sku: string, channelKey?: string, currency?: 'EUR' | 'USD'): Promise<Money | null>;
```

Rows are the store's assigned parts only. List price: the Malva standalone price with no channel (key `<sku>__base-eur-de` or `<sku>__base-usd-us`). Overrides: standalone prices on the store's retail distribution channel (`GET /standalone-prices?where=sku in (:skus) and channel(id=:ch)`, one call per page; branch-channel prices are listed by U, not here). UI columns: Product, Malva list, Your price (input, placeholder shows the list price), and a small neutral text "{n}% below Malva list price" or "{n}% above" (information only). There is no cost column and no margin chip. Parts with no list price show "Price pending" and a disabled input. A line states the layer order (decision 9). The save control for zero, negative or more than two decimals is disabled with the message "Enter a price above zero with at most two decimals".

### T-06 Price writes [SKILL: commercetools-commerce-patterns]

`publishPrices` and `setStandalonePrice` per section 6 (no floor). Write calls:

```
// upsert by key (create or change value)
POST /standalone-prices
{ "key": "MLV-BP-41001__mau-dist-north", "sku": "MLV-BP-41001",
  "value": { "type": "centPrecision", "currencyCode": "EUR", "centAmount": 9000, "fractionDigits": 2 },
  "country": "DE", "channel": { "typeId": "channel", "key": "mau-dist-north" } }
// USD for country US: key "MLV-BP-41001__mau-dist-south__usd", value USD, "country": "US"
POST /standalone-prices/key=MLV-BP-41001__mau-dist-north
{ "version": 3, "actions": [ { "action": "changeValue", "value": { "currencyCode": "EUR", "centAmount": 9100 } } ] }
DELETE /standalone-prices/key=MLV-BP-41001__mau-dist-north?version=3     // blank input = fall back to the Malva list price
```

Look up the existing price by key first (the seeded retail prices of about half of the carried parts already exist under the same key scheme, so a first save for such a part is a `changeValue`, not a create); on a 409 re-read and retry with the latest version. Key helper `standalonePriceKey(sku, channelKey, currency)` returns `<sku>__<channelKey>` or `<sku>__<channelKey>__usd` exactly as the seed's `channelPriceKey` does (characters outside `[A-Za-z0-9_-]` replaced by `-`; the seed keys contain none). Predicate lookups use `var.` variables (the SKU comes from the request body). A price never edits the Malva base price (a key without a channel is refused by the writer).

Routes: `PUT /api/seller/prices` (`{ storeKey, currency?, changes: [{ sku, centAmount | null }], confirm, expectedCount }`), `POST /api/seller/prices/bulk` (`{ storeKey, currency?, mode: 'percentOfList' | 'setTo', value, skus | filter, dryRun }`: with `dryRun: true` returns per-part new price and its distance from the Malva list, plus `invalid` for a result of zero or less, and writes nothing), `POST /api/seller/prices/import` (CSV `sku;price`, `;` or `,`, max 2000 rows, same preview then publish). All call `publishPrices`; none calls commercetools price writes directly. Each has a cross-store test and the role matrix test. A save never asks about cost: there is none.

### T-07 Product info and image tailoring [SKILL: commercetools-commerce-patterns] [SKILL: commercetools-storefront]

Files `lib/ct/seller/tailoring.ts`, `lib/catalog/tailoring-schema.ts`. Copy the call shapes from `/Users/behnam/code/b2b2c-starter/dealer/lib/ct/product-tailoring.ts` and confirm builder names and the image action names (`setImages` on a variant by `sku`, staged) with the Knowledge MCP `commercetools-oas-schemata` (resource `api-ProductTailoring-write`).

```ts
export const TailoringInput = z.object({ storeKey: z.string(), productId: z.string(),
  name: z.record(z.string()).optional(), description: z.record(z.string()).optional(),
  images: z.array(z.object({ url: z.string().url(), label: z.string().max(120).optional() })).max(10).optional() }).strict();
export async function saveTailoring(storeKey, productId, input, by): Promise<{ published: true }>;
export async function resetTailoring(storeKey, productId): Promise<void>;
```

- Save: upsert the ProductTailoring in the store (`inStoreKeyWithStoreKeyValue({ storeKey }).products().withProductId(...).productTailoring()`), actions `setName`, `setDescription`, `setImages` (staged), then **`publish` in the same request** (decision 10). No pending record, no review state. Languages must be among `store.languages`; others are rejected with 422. Image urls must be https and either under the Contentools upload origin or pass the pasted-URL check of T-08.
- Reset: delete the tailoring (`DELETE ...product-tailoring?version=`); the "Tailored" chip disappears.
- List `GET /api/seller/tailoring?storeKey=&offset=&limit=` returns rows `{ productId, sku, name (master), tailored: boolean, tailoredLocales: string[], hasTailoredImages: boolean }`; detail `GET /api/seller/tailoring/[productId]?storeKey=` returns master and tailored values side by side (including master images and tailored images); `PUT` saves; `POST /api/seller/tailoring/[productId]/reset`.
- Localisation check after the first save (T-07 acceptance): read the in-store product projection with the MCP for a store language that was **not** tailored. If it returns the master text, done. If the field is missing or empty for that locale, apply mitigation: when saving, fill untailored locales with the current master value and keep `tailoredLocales` so the UI still shows them as untailored; add a note in Notes.
- Image selection check (T-07 acceptance): the in-store projection of store A returns the tailored images for the master variant while store B still returns the master images; record the finding (it is the base of the L and M contract in section 5b).
- UI `catalog/product-info/page.tsx`: product list with "Tailored" chip and an "Images" chip, editor with a language switch for the store languages, an **image panel** (shows master images read-only, tailored images with add by upload, add by URL, remove and move up and down, first is primary; "Use master images" resets only the images), a "Master record" panel stating exactly "Untailored fields fall back to the master. Tailoring changes how a product looks, never whether it's available. SKU, fitment and specs stay locked." and the locked fields read-only, a "Reset to master" button with confirmation. Save shows "Published. Shoppers see it within a minute." (cache, decision 20).

### T-08 Image upload and URL intake for tailoring [SKILL: commercetools-connect]

`lib/catalog/image-rules.ts`: `validateImage(buffer, mime): { ok: true; width: number; height: number } | { ok: false; message: string }` (magic-byte sniffing for JPEG, PNG, WebP; do not trust the `Content-Type`; dimensions via `image-size`, pin the version in `package.json`). Message exactly: "Use a JPG, PNG or WebP of at least 600 x 600 px and at most 10 MB." `interface ImageStore { upload(storeKey: string, file: File): Promise<string /* url */> }` with `FakeImageStore` (tests) and `ContentoolsImageStore` (`POST ${CONTENTOOLS_ORIGIN}/service/${encodeURIComponent(storeKey)}/upload-file` multipart field `file`, headers `x-project-key: CTP_PROJECT_KEY` and `Authorization: Bearer ${await getValidContentoolsJwt()}`, response `{ url }`; store only the clean URL without query string). Wire `ContentoolsImageStore` only if `lib/contentools/jwt.ts` exists (U-03); otherwise keep the fake behind an env guard that is off in production, add TODO row `M-T-3`, and continue.

`fetchImageFromUrl(url)` (pasted URL): https only, no credentials in the URL, resolves DNS and refuses private, loopback and link-local addresses, follows at most 2 redirects (re-checking each), 5 s timeout, 10 MB cap, then the same `validateImage`; the saved URL is the pasted one. Routes: `POST /api/seller/tailoring/[productId]/image` (multipart upload: validate, upload, return `{ url }`; it does not save) and `POST /api/seller/tailoring/[productId]/image-url` (`{ storeKey, url }`: validate and return `{ url, width, height }`; it does not save). The editor's Save then sends the `images` array through `PUT`, which publishes at once.

### T-09 Discounts: reads, writes, ownership [SKILL: commercetools-commerce-patterns]

Files `lib/ct/seller/discounts.ts`, `lib/ct/seller/discount-access.ts` (port the shapes from `/Users/behnam/code/b2b2c-starter/dealer/lib/ct/discount-access.ts`).

- `listDiscounts(storeKey, kind)`: product discounts via `productDiscounts().get({ limit: 500, sort: 'sortOrder desc' })` filtered by `belongsToStore` or `isMalvaFunded`; cart discounts via `cartDiscounts().get({ queryArgs: { where: 'stores(key=:s) or custom(fields(storeKey=:s))', 'var.s': storeKey, limit: 500, sort: 'sortOrder desc' } })` plus a second read `where: 'custom(fields(fundedBy="malva"))'` for the Malva-funded ones (type `mau-cart-discount-fields`; product discounts have no custom fields, so Malva-funded product discounts are picked in code by key prefix `mau-pd-malva-`, the query language has no prefix match). Return `{ id, version, key, name, scope, effect, validFrom, validUntil, isActive, sortOrder, funded: 'malva' | 'store', rank }`. Scope strings as in the spec: "Category · Brakes", "MLV-WB-90015", "Cart total ≥ €2,000"; effect strings "−8%", "−€2.00 / unit", "Shipping €0".
- Every `[id]` route checks ownership by id with `belongsToStore` (decision 13) before reading or writing (404 for a foreign discount, not 403, to avoid leaking existence; the cross-store test accepts 404) and refuses Malva-funded changes (403 `LOCKED_MALVA_FUNDED`).
- Create: `POST /api/seller/discounts/product` and `.../cart` with `{ storeKey, rule }` compile (T-01), allocate sortOrder, create inactive (a cart discount also gets `stores: [store]` and the custom type `mau-cart-discount-fields` with `fundedBy: 'reseller'` and `storeKey`, decision 13). "New cart discount" with an empty body creates the draft "New cart rule (draft)": inactive, unscheduled, `value` relative 0 permyriad is invalid, so create it with `value: { type: 'relative', permyriad: 1 }` and mark it draft by key suffix `-draft` until the editor saves a complete rule.
- Toggle: `POST /api/seller/discounts/{product|cart}/[id]/active { storeKey, isActive }` with `changeIsActive`; activating re-runs `validateRule` (E5).
- Edit: `PATCH` with the structured rule; the compile function re-appends the channel clause or `stores`, so an edit can never widen the scope (reference `withChannelClause`).
- Codes: for a cart rule with `code`, create `POST /discount-codes { "code": "BRAKE5", "cartDiscounts": [{ "typeId": "cart-discount", "id": "<id>" }], "isActive": true }` and set the cart discount `requiresDiscountCode: true`; duplicate codes answer 409 `CODE_TAKEN`. Codes must work in the hosted Checkout cart (the cart is an ordinary commercetools cart; N and O prove it).
- Priority: `PUT /api/seller/discounts/priority { storeKey, kind, orderedIds }` must contain exactly the store's reseller discounts of that kind (409 `STALE_LIST` otherwise), then `rankToSortOrders` and one `changeSortOrder` per discount whose value changed, writing with version-safe retries; values are permuted among the store's own values (no collision with other stores). Rank 1 = highest sortOrder.
- `scripts/check-sortorder-bands.mjs` (admin client, read-only): classifies discounts by funding (decision 13), fails if a Malva-funded discount of a kind ranks below any reseller discount of that kind (direction from `SORT_HIGHER_FIRST`) or, for T-created values, if a reseller value is outside 0.05 to 0.89 or a Malva value outside 0.90 to 0.99; run in T-00 and in Z. The seed's current values (Malva 0.11, reseller 0.51 to 0.53) make it fail until the seed request on sort orders is applied; the script names those keys instead of hiding them.
- Safe discounts (decision 16): `validateRule` rejects out-of-range values and bad schedules (422 with the field). No cost warning (no cost price), no block, no floor.

### T-10 Discount UI [SKILL: commercetools-storefront]

- `catalog/product-discounts/page.tsx` and `catalog/cart-discounts/page.tsx`: list (name, scope, effect, run window, Active toggle), buttons "New product discount" and "New cart discount"; toggle off keeps the row listed and stops it for new carts; Malva-funded rows locked.
- `catalog/discounts/[kind]/[id]/page.tsx` editor: target (scope or condition), effect, schedule (`validFrom`, `validUntil`, validated `from < until`), stacking (cart), code (cart), plain-language summary from `describeRule`, and a **Preview** card (sample cart editable, default one line item) using `previewRule` (for -3% on carts of EUR 2,000 or more and a sample of EUR 2,500 the sample shows a named line "-EUR 75.00"). There is no cost banner.
- `catalog/priority/page.tsx`: statement "Malva price → your override → product discounts → cart discounts"; two lists (Product, Cart). Malva-funded rows first, type "Malva", rank "—", reduced opacity, "Locked", no move buttons; reseller rows ranked 1..n with up/down buttons; a row cannot cross out of its kind; "Only the highest-ranked matching product discount applies; cart discounts stack unless stopped." Save sends the ordered ids.
- Promo code status (spec "Promo codes visible with reasons"): `lib/discounts/code-status.ts` `codeStatus(state: DiscountCodeState): { label: string; applied: boolean }` mapping `MatchesCart` to "Applied", `DoesNotMatchCart` to "Not applied: cart doesn't match", `NotActive`, `NotValid`, `MaxApplicationReached`, `ApplicationStoppedByPreviousDiscount` to their own sentences, plus `components/discounts/DiscountCodeStatus.tsx` that the storefront cart (N) reuses (named savings come from `discountOnTotalPrice.includedDiscounts` and `lineItem.discountedPricePerQuantity`).

### T-11 Copilot action [SKILL: commercetools-storefront]

`lib/portal/copilot-discounts.ts`: `registerCopilotAction({ id: 'set-discount-active', permission: 'discount.edit', match: /^(pause|deactivate|turn off|activate|turn on)( the)? (.+)$/i, describe: ("Set 'Brake season promo' to inactive"), apply: calls the same service as the toggle route })`. Ambiguous names answer with the matching names; Malva-funded names are refused with the locked message. Import it once from the portal layout's client bootstrap.

### T-12 Messages, tokens, routes

All strings in `messages/{de-DE,en-US}.json` under `catalog.*` (identical keys). `check-tokens` green. Add the six catalog sub-routes to `ROUTE_ALLOW_LIST` (R-02) as `catalog/*`.

### T-13 Scripts

- `scripts/verify-assortment-propagation.mjs <storeKey> <sku> present|absent` (section 7, P2).
- `scripts/reconcile-assortment.mjs <storeKey>`, `scripts/check-sortorder-bands.mjs` (all read env from `portal/.env.local`, refuse any store key not in an allow-list of seeded keys unless `--allow-any` is passed).
- `scripts/verify-discount-preview.mjs <storeKey> <discountId>` creates a temporary cart in the store with the preview's sample lines, reads the applied discount, prints preview vs actual, and deletes the cart (refuses to run on an inactive discount).

### T-14 Gate G9 and evidence

Run the Chrome recipe (section 11) and the MCP read-backs (section 12). If the storefront L or M routes are not built yet, run P1 and P2 only, add row `M-T-2` (storefront re-check) to the manual file, and continue; Claude repeats the storefront step when L and M are done.

## 10. Test-first scenarios (vitest)

Run: `cd portal && npx vitest run lib/catalog lib/ct/seller lib/discounts app/api/seller scripts`.

| File > test name | Asserts |
| --- | --- |
| `lib/catalog/assortment-state.test.ts` > one test per state from the spec table, plus `pending-review` | `deriveState` and `STATE_UI` (tone, action label, disabled for blocked, no action for pending review) |
| `lib/ct/seller/assortment.test.ts` > `states from the seed shape: MLV-HL-56002 blocked upstream, MLV-BP-41099 pre-release, MLV-BP-41003 withdrawn by reseller in north, SK-2002 pending review in south, KW-1001 local in north only` | row states |
| same > `pre-release part is never shown as 0` | list price null renders "Price pending" |
| `lib/catalog/margin.test.ts` > `below list percent and above list percent are neutral text; there is no margin or cost export` | labels and tones |
| `lib/ct/seller/price-keys.test.ts` > `standalonePriceKey equals the seed's channelPriceKey for EUR and USD (MLV-BP-41001__mau-dist-north, MLV-BP-41001__mau-dist-south__usd)`; `country follows the currency` | key scheme |
| `lib/rules/price-money.test.ts` > `0, negative, 3 decimals, other currency, highPrecision are INVALID_MONEY; 1 cent passes` | validation |
| `lib/catalog/sort-order.test.ts` > `allocated values are unique, inside 0.05 to 0.89, never end in 0; malva-funded band is 0.90 to 0.99` and `rank 1 gets the highest value and values are a permutation of the originals` | direction and uniqueness |
| `lib/catalog/discount-rule.test.ts` > compile product and cart examples equal the JSON in T-01; `predicate rejects ids with quotes`; `describeRule` strings; `previewRule: -3% on 2500.00 gives -75.00`; `validateRule rejects 0%, 101%, from after until` | compile, preview, validation |
| `lib/ct/seller/assortment.test.ts` > `blocked upstream cannot be assigned (409) and nothing is written` | mock call count 0 |
| same > `local part of another store never appears in this store's list` | rows |
| same > `isAssigned is true for an assigned SKU, false for withdrawn, available, blocked, unknown and other stores' parts` | guard for W |
| same > `withdraw without confirm or with wrong expectedCount is 409 and writes nothing` | calls |
| same > `withdraw removes from selection and records withdrawn; reinstate adds back and clears the record; onAssortmentChanged hooks run` | actions |
| same > `409 ConcurrentModification retries with the latest version` | versions sent |
| same > `reconcileAssortment removes parts no longer approved upstream` | actions |
| same > `bulk of 40 products reports count and open carts before applying` | impact |
| `lib/ct/seller/prices.test.ts` > `ignores client supplied list, cost and currency (strict schema, 400)` | strict schema |
| same > `price of 0 or negative: 400 INVALID_MONEY, zero writes` | calls 0 |
| same > `any price above zero is accepted, including a price far below the Malva list (no floor)` | 200 and one write |
| same > `batch of 3 with 1 invalid: nothing written` | calls 0 |
| same > `cross-store: user of store A changing a part in store B gets 403 and commercetools mock is never called` | calls 0 |
| same > `order of checks: 403 before validation before count 409` | status sequence |
| same > `a price on a channel that is not the store's retail channel or one of its branch channels is 404 CHANNEL_NOT_FOUND` | codes |
| same > `blank input deletes the override; list price applies` | DELETE call |
| same > `part not in assortment is rejected` and `price pending part is rejected` | codes |
| same > `uses key upsert and the latest version on 409; refuses a key without channel (Malva base price untouched)` | request shapes |
| same > `setStandalonePrice with a branch channel key writes that channel's price; default channel is the store distribution channel` | request body |
| `lib/ct/seller/prices.single-writer.test.ts` > `standalonePrices write methods appear only in prices.ts` | grep |
| `lib/ct/seller/tailoring.test.ts` > `strict schema rejects sku, fitment, slug`; `save sets staged name, description and images and publishes in the same request; no unpublish; no review record`; `reset deletes tailoring`; `language outside store languages is 422`; `more than 10 images, non-https url, url with credentials are rejected` | calls |
| `lib/catalog/image-rules.test.ts` > `gif refused; 599 px refused; 11 MB refused; mime lie (png bytes named .jpg) accepted by bytes; exe renamed .png refused` | messages |
| `lib/catalog/image-url.test.ts` > `private, loopback and link-local hosts refused; redirect to a private host refused; timeout; size cap; valid https image accepted` | SSRF guard |
| `lib/ct/seller/discounts.test.ts` > `list shows only this store's and Malva-funded discounts` | filter |
| same > `foreign discount id answers 404 on read, patch, toggle and delete` | statuses |
| same > `Malva-funded discount: patch, toggle and delete are 403 LOCKED_MALVA_FUNDED` | statuses |
| same > `toggle off keeps the discount listed` | isActive only |
| same > `new draft is inactive and unscheduled` | body |
| same > `edit cannot drop the channel clause or stores` | predicate |
| same > `a T-created cart discount carries stores and mau-cart-discount-fields (fundedBy reseller, storeKey); a Malva-funded one is recognised by fundedBy or the key prefix mau-pd-malva-` | body and flags |
| same > `priority: moving a product discount past the last product discount stops; does not enter cart group` | ids |
| same > `priority: stale list is 409` | status |
| same > `priority writes sortOrder so rank 1 > rank 2 > rank 3` | values |
| same > `duplicate discount code is 409 CODE_TAKEN` | status |
| `lib/discounts/code-status.test.ts` > `BRAKE5 on a cart without brake parts reads "Not applied: cart doesn't match"` and one per state | labels |
| `app/api/seller/**/route.test.ts` > role matrix: for every write route `buyerA` 403, `adminA` 200 | statuses |
| `app/api/seller/**/route.cross-store.test.ts` (one per route; required by `check-routes`) | `expectCrossStoreForbidden` |
| `components/catalog/*.test.tsx` > `Buyer sees disabled actions with "Insufficient permissions to perform this task"`; `withdraw dialog names count and open carts`; `zero price disables Save with the message`; `priority list: Malva rows have no move buttons`; `image panel: add by URL, remove and reorder change the saved array` | DOM |
| `lib/portal/copilot-discounts.test.ts` > `Pause the Brake season promo returns confirm with "Set 'Brake season promo' to inactive", nothing changes until Confirm, Malva-funded is refused` | spy |

## 11. Chrome DevTools MCP recipe

Preconditions: portal on `http://localhost:3001`, two seeded resellers A and B (`<storeA>` = `mau-reseller-north`, `<storeB>` = `mau-reseller-south`; selections `mau-sel-north`, `mau-sel-south`), demo users from `seed/README.md`, storefront on `http://localhost:3000` if L and M exist (routes from `plans/workstreams/L-*.md` and `M-*.md`). Screenshots to `plans/evidence/T/<nn>-<name>.png`. After each page: `list_console_messages` shows no errors.

**A. Assortment**

1. Sign in as Admin of A. `navigate_page http://localhost:3001/de-DE/catalog` at 1440 x 900. Snapshot: chain card, six tabs in order, "You · edits this level", branches "Inherit from you", counter "{n} of {total} master products assigned", rows with chips. Screenshot `01-assortment-1440.png`.
2. Filter Blocked upstream: every row (seeded: `MLV-HL-56002`, "Malva DACH: No type approval for road use in Germany") has a disabled "Can't re-add". `evaluate_script` forced attempt: `fetch('/api/seller/assortment/assign', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ storeKey:'<storeA>', productIds:['<blockedProductId>'] }) }).then(r=>r.status)` returns 409. MCP read-back (section 12, item 2) shows no change.
3. Pre-release row (seeded `MLV-BP-41099`): reads "Price pending", chip Pre-release, action Assign. Also check, on store A (`mau-reseller-north`), `MLV-BP-41003` as "Withdrawn by you" (seeded, "Quality policy: premium brake parts only") with Reinstate; on store B (`mau-reseller-south`), `SK-2002` as "Awaiting Malva review" with no action.
4. Pick one Inherited part (note its SKU and name). Click Withdraw here: dialog names the count and open-cart impact; Cancel changes nothing (MCP unchanged); Withdraw again and confirm: chip becomes "Withdrawn by you", reason mentions branches. Screenshot `02-withdraw-dialog.png`.
5. Propagation (section 7): run `node scripts/verify-assortment-propagation.mjs <storeA> <sku> absent` (exit 0 within 90 s). MCP item 3. Then on the storefront (if built) open the store A listing and the part page: gone after at most 2 minutes (reload with `navigate_page` every 20 s, `wait_for` text); store B storefront still shows it. Screenshot `03-storefront-gone.png`.
6. Reinstate: chip Inherited again, `present` script exit 0, storefront shows it again. Screenshot `04-storefront-back.png`.
7. Bulk: select a category line of 10 or more rows (or "Select all matching filter"), Withdraw: the dialog names that count. Cancel.
8. Local product (seeded `KW-1001`, owner `mau-reseller-north`): chip "Local addition" in A; sign in as Admin of B: not listed.

**B. Prices (no floor)**

9. Tab Price overrides. For a part with list L: type 0 and then -5: Save disabled with "Enter a price above zero with at most two decimals". Type 0.01: accepted as input (information text "99.9% below Malva list price", neutral tone). Screenshot `05-price-input.png`.
10. Attack the server directly: `evaluate_script`: `fetch('/api/seller/prices', { method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify({ storeKey:'<storeA>', changes:[{ sku:'<sku>', centAmount:0 }], confirm:true, expectedCount:1 }) }).then(async r=>[r.status, await r.json()])`. Expect 400 or 422 with `error.code` `INVALID_MONEY` (or equivalent validation code); send it again with extra keys `list:1, cost:1`: expect 400 (strict body). MCP item 4: no standalone price created or changed in either case.
11. Distance from list: a price 12% under the Malva list shows the neutral text "12% below Malva list price", one above shows "n% above"; no chip, no warning tone and no confirmation appears at any value above zero. On a part that already has a seeded retail price (for example one that `read_standalone_prices` shows on `mau-dist-north`) the input starts with that value and the save is a change of the same key, not a second price. On store B switch the currency to USD: the key written ends in `__usd`, country US.
12. Valid publish: enter 90.00 on a part: Save shows a confirmation naming "1 part changed"; confirm. MCP item 4 shows the standalone price with channel = store A's distribution channel, key `<sku>__<channelKey>`, 9000 in the store currency. The PLP, PDP and cart of store A show 90.00; store B still shows the Malva list price. Then enter a price far below the list (for example 10 percent of list): accepted (no floor), shown on the storefront. Blank input then deletes the price and the storefront shows the list price again. Screenshot `06-price-published.png`.
13. Bulk: "set to list +8%" on 5 parts: preview shows new price and the distance from list per part and flags invalid (zero or negative) cases; publish needs confirmation with the count. A bulk of "list −100%" flags every row invalid and publish is blocked (zero writes; MCP unchanged).

**C. Tailoring (text and images, publish at once)**

14. Tab Product info: master panel text exact. Edit the German description of a part and save: chip "Tailored", "Published" message, **no** review chip. Storefront (store A, de-DE) shows the tailored text after the cache lifetime; en-US shows the master English text (localisation scenario); store B shows the master. MCP item 5: tailoring is published.
15. Images: upload a `.gif` and a 300 x 300 PNG: both refused with the exact limit message; a valid 800 x 800 JPG is accepted (through Contentools when U's JWT exists, else the fake store and `M-T-3` is open); paste an https image URL: accepted; paste `http://127.0.0.1/x.png`: refused; reorder so the pasted image is first; Save. The store A PDP and PLP card show the first tailored image after the cache lifetime; store B shows the master image. MCP item 5 shows the images in the tailoring. "Use master images" restores the master image. Screenshot `07-tailored-images.png`.
16. Reset to master: chip gone, master text and images everywhere.

**D. Discounts**

17. Tab Product discounts: the seeded Malva-funded discount (`mau-pd-malva-filter-autumn`) is locked; toggle a reseller discount off: still listed; MCP item 6 shows `isActive: false`. "New cart discount": row "New cart rule (draft)", inactive, unscheduled. Open the editor, build "-3% on cart total of 2000": preview with a sample of 2500 shows "-€75.00". Try 0% or 101%: blocked with the field message. Screenshot `08-discount-editor.png`.
18. Tab Discount priority: Malva row shows "—", "Locked", dimmed, no buttons; move a product discount down past the last: it stops. Save: MCP item 6 shows sortOrders in the new order (rank 1 has the highest value).
19. Promo code: create a code `QA-BRAKE5` on a cart discount scoped to category Brakes, then in the storefront cart apply it to a cart without brake parts: "Not applied: cart doesn't match" and totals unchanged (storefront only if N is done, else the unit test and `M-T-2`). Apply it to a cart with brake parts and continue into the hosted Checkout (if O is done): the discount is on the order.
20. Copilot: type "Pause the <discount name>": confirm panel with the exact text; Cancel leaves it active; Confirm sets inactive (MCP).

**E. Roles and cross-store**

21. Sign in as Buyer of A: Catalog & pricing visible, every action disabled with the exact message, `evaluate_script` writes return 403.
22. Admin of A sends writes naming `<storeB>` (price, assign, tailoring, discount toggle on a B discount id): all 403 or 404, and MCP shows no change in B. Screenshot `09-cross-store.png` (network table).
23. Viewports: 1024 and 375 for the assortment and price tabs: table scrolls horizontally inside its card, page has no horizontal scroll. Screenshots `10-assortment-375.png`, `11-prices-375.png`.

## 12. `b2b2c-automotive` MCP read-back checks (read-only tools)

1. `read_product_selections` (keys `mau-sel-malva-master`, `mau-sel-north`, `mau-sel-south`) and `read_stores` (`<storeA>`): the reseller selection is assigned and active on its store only; the master selection is assigned to no store; `read_custom_objects` container `mau-assortment`, keys `<storeA>` and `<storeB>`, have the four lists of decision 3.
2. `read_product_selection_assignments` or `read_product_selections` expanded products: blocked-upstream parts are not in the reseller selection after the forced assign attempt.
3. After withdraw: the part is gone from `mau-sel-<store A>` and still in the other store's selection; `read_product_search` (in store A) no longer returns the SKU after the propagation script exits 0; `read_custom_objects` container `mau-assortment` key `<storeA>` lists it in `withdrawnByReseller` and its other fields are unchanged. After reinstate the reverse.
4. `read_standalone_prices` for the SKU: before the attack the seeded value (or none); after rejected writes unchanged; after the valid publish exactly one price per currency with the store's distribution channel and the seed key scheme (`<sku>__<channelKey>`, `<sku>__<channelKey>__usd`), the version of the seeded key increased (changed, not duplicated); `read_channels` to map the channel to its key; the Malva base price (no channel, keys `__base-eur-de`, `__base-usd-us`) is unchanged.
5. `read_product_tailoring` for the store: name, description and images set and `published` true right after save, absent after reset (no staged-only state).
6. `read_product_discounts` and `read_cart_discounts`: reseller discounts carry the channel clause or `stores`, are created inactive, sortOrders match the ranks and are below the Malva-funded values (decision 14); Malva-funded ones unchanged (compare `version` before and after the whole recipe).
7. `read_carts` for store A: impact count equals the dialog's open-cart count.

## Seed requests

The seed is the source of truth and is not edited from here. The same rows are in `plans/notes/seed-requests.md`.

| What | Why |
| --- | --- |
| Discount sort orders: Malva-funded `mau-pd-malva-filter-autumn` and `mau-cd-malva-welcome` use `0.11` and the reseller discounts `0.51` to `0.53`; request Malva-funded values in `0.91` to `0.99` (reseller values stay) once T-00 confirms that a higher `sortOrder` is prioritised (Q-S05) | The portal shows Malva-funded discounts locked at the top and ranks reseller discounts below them; with the seed values the platform would apply the reseller discounts first. If T-00 finds the opposite direction, no seed change is needed and `SORT_HIGHER_FIRST` flips |
| Set `stores: [{ typeId: 'store', key }]` on the reseller cart discounts `mau-cd-north-large-order` (north), `mau-cd-south-brake-code` and `mau-cd-south-free-shipping` (south); keep none on `mau-cd-malva-welcome` | Without `stores` a cart discount applies in every store, so north's large-order discount also fires in south; T lists a store's discounts by `stores` and, until this is done, by the custom field `storeKey` |
| Remove `maxDiscountPercent` from the custom fields of `mau-cd-north-large-order` and `mau-cd-south-brake-code` (the type `mau-cart-discount-fields` has no such field, so the API would reject the draft) | Seed data and seed type disagree; the floor-like rule was dropped (Q-T03) and T never reads the field |
| Optional: scope the reseller product discounts `mau-pd-north-brake-week` and `mau-pd-south-battery-bonus` to their store (predicate clause on the store's retail channel, resolved at seed time) | Product discounts are project-wide; without a store clause they also reduce prices in the other store. T recognises them as the store's own by key prefix and adds the channel clause to every discount it creates |

## 13. Manual items for `plans/TODO-MANUAL-TESTING.md` (never wait silently)

The lead merges these into the master file with the ids shown.

| ID | Needed by | Action | Expected |
| --- | --- | --- | --- |
| OA-01 (exists) | T-00 | The admin API client in `portal/.env.local` must carry the scopes listed in `.env.example` for T | writes succeed live |
| OA-12 (was OA-T-1) | T-00 | Add the new scopes (product selections, standalone prices, tailoring, discounts, discount codes, carts view, key-value documents) to the **admin** API client; Claude lists exact strings in the TODO file after T-00 | 403 on writes disappears |
| SO-01 (exists) | T-04, T-05, T-10 | Sign off undesigned screens: catalog filters, bulk bar, discount editor, priority save flow, tailored image panel | approved or change list |
| M-T-1 | T-14 | Compare the six tabs with `design/export/Malva Seller Portal.dc.html` page `catalog` at 1440 px, light and dark | matches except documented changes |
| M-T-2 | T-14 | Storefront re-check of withdraw, price, tailored image and code behaviour once L, M and N exist (only if not yet possible) | same results as recipe steps 5, 6, 12, 15, 19 |
| M-T-3 | T-08 | Image upload against the real Contentools once OA-02 and U-03 are done (only if the fake store was used), for tailored product images | upload returns a clean URL, tailoring shows the image on the storefront |

## 14. Definition of done

- All tests in section 10 written first, failing, then passing; `npm run check` and `npm run build` green; every `app/api/seller/**` route has a cross-store test (`check-routes` green).
- Prices: the forced `PUT` of price 0 in recipe step 10 is rejected and MCP shows no change; a price far below the Malva list is accepted and appears in PLP, PDP and cart; the single-writer test and E1 to E4 tests pass; no `map-floor`, `computeFloor`, `BELOW_MAP_FLOOR` or `malva-rules` anywhere in `portal/` (grep in the test).
- Assortment: withdraw and reinstate proven by MCP and `verify-assortment-propagation.mjs`; storefront proof done or `M-T-2` open with Claude's reminder in Notes.
- Tailoring: text and images publish at once (MCP `published: true`, storefront shows both after the cache lifetime), store B unaffected.
- Role matrix proven: Admin writes, Buyer read-only, in unit tests and in Chrome.
- Discount ranks verified against sortOrder direction in MCP; Malva-funded discounts untouched (versions equal).
- `.env.example` and `scopes.ts` list every scope with a reason; no admin client import outside the allowed folders.
- Q-T01 to Q-T10 present in `plans/notes/questions-RSTU.md` with the defaults used (Q-T03, Q-T06, Q-003, Q-005 answered by the owner).

## 15. Evidence

`plans/evidence/T/01-assortment-1440.png`, `02-withdraw-dialog.png`, `03-storefront-gone.png`, `04-storefront-back.png`, `05-price-input.png`, `06-price-published.png`, `07-tailored-images.png`, `08-discount-editor.png`, `09-cross-store.png`, `10-assortment-375.png`, `11-prices-375.png`, and under "Notes": the propagation script output (seconds until absent and present), the rejected price response body of step 10, MCP read-back lines, the tailoring localisation finding, the image selection finding, and the standalone price consumption finding (decision 5).

## Progress

- 2026-10-12 J11: T-00 to T-13 built test-first against a mocked SDK (not live). One in-memory fake commercetools (`lib/portal/catalog-fixture-root.ts`) serves both the unit tests and the browser run with `PORTAL_DEV_FIXTURES=on`; `lib/ct/seller/catalog-root.ts` switches between it and the admin client.
- Assortment (`assortment*.ts`): master inheritance, assign, withdraw with a 409 `CONFIRMATION_REQUIRED` impact (count, open carts, branches), reconcile, `isAssigned` guard, `onAssortmentChanged` hooks. Prices (`prices.ts`) are the single writer of standalone prices (a test greps for it and for banned floor or cost terms). Tailoring (`tailoring.ts`, `image-url.ts` SSRF guard, `image-rules.ts` by magic bytes), discounts (`discounts.ts`, `discount-rule.ts`, `sort-order.ts` two-phase reorder, `discount-access.ts`).
- 22 seller routes, each with `route.cross-store.test.ts`, and `app/api/seller/roles.matrix.test.ts` (Buyer 403, Admin 2xx, signed-out 401). `tailoring.edit` added to `ACTION_ROLES`. Admin scopes added (OA-12 lists them). Copilot action `set-discount-active` in `lib/portal/copilot-discounts.ts`, imported by the two copilot routes.
- UI: six tabs plus the discount editor under `app/[locale]/(portal)/catalog/**`; component tests in `components/catalog/catalog-components.test.tsx`. Production image upload delegates to U's `uploadStoreFile`.
- Chrome (fixtures, port 3120, own isolated context): assortment at 1440, 1024 and 375, price zero error and publish, product discounts, editor with preview, priority, product info as Buyer (all disabled). Console: no errors or warnings. Cross-store GET 403 and Buyer PUT 403 by curl. Evidence in `plans/evidence/T/portal-*.png`. The storefront steps (recipe 5 to 8) wait for L and M (M-T-2).
- Gates: `npm run check` (174 files, 1318 tests) and `npm run verify:build` (dummy env) green. Live checks left: M-T-1 to M-T-7, M-F-02, OA-12.
- Q-T11 to Q-T16 added to `plans/notes/questions-RSTU.md` (deviations).

## Notes

(Fill in during the work.)

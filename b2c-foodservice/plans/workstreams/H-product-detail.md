<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream H: Product detail

## 1. Header

| Field | Value |
| --- | --- |
| ID | H |
| Name | Product detail: gallery, variant selectors per product shape, fulfilment choice (collect, ship, subscribe), availability, add to bag, guides, related products |
| Depends on | G (cards, summary mapper, cart core, categories, search builder), F (store context, availability API, shipping figures, toast), plus C, D, E through G |
| Wave | 5 (alone) |
| Specs implemented (primary first) | `design-product-detail-page` (primary), `product-detail-page` (generated template, applies), `fulfilment-and-availability-model` (extended: "Availability per store" PDP side, "Fulfilment per line" for collect, ship and subscribe, "Subscriptions" gate and add), `reviews-and-ratings` (extended: rating and distribution summary on the page; the list and the form belong to M) |
| Generated templates that apply | `product-detail-page` |
| Owner prerequisites | OA-x1 (live API client, same as OA-01), OA-x2 (images, OA-03), SO-x1 (compatibility guide and grind guide copy, brewing and care copy, trust-row wording, "price on request" wording), SO-x2 (delivery estimate rule: cut-off hour and days). Nothing blocks the build |
| Skills to load first | `commercetools-storefront` (`core/product-detail.md`, `b2c/product-detail.md`, `b2c/variant-config.md`, `b2c/optional/bopis.md`, `core/optional/recurring-prices.md`, `b2c/optional/recurring-prices.md`), `commercetools-commerce-patterns` (price selection, tiers, discounts), `commercetools-platform` |
| App and paths | `storefront/` |

## 2. Goal and scope

**Goal.** One layout turns interest into a committed line for four product shapes (pods, coffee, machines, accessories): the right variant, the right fulfilment (collect, ship or subscribe) and a clear statement of when the shopper gets it. The page shows the price the shopper would actually pay, the real stock per store and online, and never offers a combination it cannot add.

**In scope**
- Route `/[locale]/p/[slug]/[sku]`, server-rendered data load, metadata, 404.
- Layout, gallery (variant imagery), buy-box header, selectors per shape (config driven), read-only facts (intensity bar, flavour notes, roast), compatibility guide and grind guide modals.
- Fulfilment cards with collect block (status, store, readiness, change store), ship block (delivery estimate), subscribe block (interval select and recurring price).
- Stepper, add button state machine, trust row, accordions.
- `POST /api/cart/lines` branches for `collect` and `subscribe` (G created the ship branch), `GET /api/recurrence-policies`.
- Rating summary and distribution on the page (statistics only), "You may also like", "Goes well with" for machines.
- Variant-level price tiers support in the price function (generic, unused by the seed; see 3.6).

**Explicitly out of scope**
- Review list, sorting, write form, moderation (M). The reviews section mounts M's component when it exists and a labelled placeholder until then.
- Cart drawer and cart page (I), quantity merging of lines (I).
- Subscription management after purchase and creating the recurring order (K, N). H only attaches `recurrenceInfo` to the line.
- Saved-items storage (L; the heart reuses G's `SaveButton`).
- B2B items (purchase list, quote, contract price table, datasheets download): excluded for B2C by the template.

## 3. Design

### 3.1 Files

| Path | Kind | Purpose |
| --- | --- | --- |
| `app/[locale]/p/[slug]/[sku]/page.tsx`, `loading.tsx`, `not-found.tsx` (shared one exists from D/P) | server | Route, `generateMetadata` |
| `lib/pdp/load.ts` | server-only | `loadProductPage(sku, ctx)` with React `cache()` |
| `lib/ct/product-detail.ts` | server-only | `getProductBySku`, `getRecurrencePolicies` |
| `lib/ct/inventory.ts` (F's file, H adds) | server-only | `getInventoryDetail(skus)` |
| `lib/mappers/product-detail.ts` | pure | `mapProductDetail` |
| `lib/product/variant-config.ts` | pure | Selector config (blocklist, renderer map, sort order, info attributes) per product type |
| `lib/product/resolve-variant.ts` | pure | `resolveVariant(variants, selection)`, `optionStates(...)` |
| `lib/product/price.ts` | pure | `effectiveUnitPrice(price, quantity)`, `lineTotal` |
| `lib/product/compatibility.ts` | pure | `podsFitMachine`, `bundleOffered` |
| `lib/product/delivery.ts` | pure | `deliveryEstimate(now, config)` |
| `lib/product/add-state.ts` | pure | `addButtonState(...)` |
| `lib/related.ts` | server-only | `getRelatedProducts`, `getCompatibleCapsules` |
| `components/pdp/ProductDetail.tsx` | server | Page composition |
| `components/pdp/Gallery.tsx` | client | Thumbnails, main image, badge, heart |
| `components/pdp/BuyBox.tsx` | client | State owner (selection, fulfilment, quantity, subscription) |
| `components/pdp/BuyBoxHeader.tsx`, `OptionGroup.tsx`, `ColourSwatches.tsx`, `FactsRow.tsx` (`IntensityBar`, `NoteChips`), `FulfilmentCards.tsx`, `CollectBlock.tsx`, `ShipBlock.tsx`, `SubscribeBlock.tsx`, `AddToBag.tsx`, `TrustRow.tsx`, `DetailAccordions.tsx`, `Accordion.tsx`, `GuideModal.tsx`, `RatingSummary.tsx`, `ReviewsSlot.tsx`, `RelatedStrip.tsx` | client/server | See 3.5 to 3.9 |
| `hooks/useRecurrencePolicies.ts` | client | SWR `KEY_RECURRENCE_POLICIES` |
| `app/api/recurrence-policies/route.ts` | handler | GET |
| `app/api/cart/lines/route.ts`, `lib/ct/cart.ts` (G's files, H extends) | handler, server-only | collect and subscribe branches |

### 3.2 Route and variant URL

`/[locale]/p/[slug]/[sku]`: the **path `sku`** identifies the product (lookup is always by SKU, never by slug; skill `core/product-detail.md`) and is the *landing variant* (the default variant: card links point to it). The `slug` is cosmetic and canonical: when it does not equal the product's localized slug, `permanentRedirect` to the canonical URL (outside any `try/catch`). **The selection lives in the query string** so a required choice can be unselected: `?size=250g&grind=espresso&colour=black&bundle=machine-only&system=original`. Keys are the variant attribute names listed in the config; values are enum keys or numbers. `choose=<attr>` (set by G's Quick add) highlights that selector (a pulsing ring token for 1.2 s, `aria-live` message "Choose a grind"). On the client, selecting an option updates state at once (all variants are already in the page payload) and mirrors the selection with `window.history.replaceState` (supported by the Next.js router integration), so the page does not re-render on the server and "price and unit price update immediately" holds. Sharing the URL reproduces the selection.

### 3.3 Reading the product (exact calls)

Docs: [Product Search exact on `variants.sku`](https://docs.commercetools.com/api/projects/product-search), [ProductProjections](https://docs.commercetools.com/api/projects/productProjections), [inventory](https://docs.commercetools.com/api/projects/inventory), [recurrence policies](https://docs.commercetools.com/api/projects/recurrence-policies). [SKILL: commercetools-storefront] [SKILL: commercetools-platform]

1. SKU to product id: `apiRoot.products().search().post({ body: { query: { exact: { field: 'variants.sku', value: sku } }, limit: 1 } })` (sku validated `^[A-Za-z0-9._-]{1,64}$` first; invalid is `notFound()`).
2. Projection: `apiRoot.productProjections().withId({ ID: id }).get({ queryArgs: { staged: false, priceCurrency, priceCountry, localeProjection: [locale], expand: ['masterVariant.price.discounted.discount', 'variants[*].price.discounted.discount', 'categories[*].ancestors[*]'] } })`. Embedded prices (D-017): each variant carries the selected `price` plus the full `prices[]`; `recurrencePrices[]` comes automatically (skill: never add it to `expand`); the same context (locale, currency, country) is used by `generateMetadata` and the page through one React-`cache()`d `loadProductPage` (skill rule: matching context).
3. In parallel after step 2 with `Promise.all`: `getAttributeLabels(locale)` (G), `getCategoryTree(locale)` (G), `getInventoryDetail(variantSkus)` and, when the product is subscribable, `getRecurrencePolicies()`.
4. `getInventoryDetail(skus)`: `apiRoot.inventory().get({ queryArgs: { where: 'sku in ("A","B")', limit: 500 } })`. Per sku returns `{ online: { quantity, restockableInDays?, expectedDelivery?, minCartQuantity?, maxCartQuantity? }, stores: Record<channelId, quantity> }` (entry without `supplyChannel` is online; entries with a supply channel are stores). Strongly consistent source; `variant.availability` is **not** used on this page (docs: eventually consistent, display only). Not cached on the server.
5. `getRecurrencePolicies()`: `apiRoot.recurrencePolicies().get({ queryArgs: { limit: 100 } })` mapped to `{ id, key, name, schedule: { unit: 'Weeks'|'Months', value } }`, cached `unstable_cache` 300 s tag `recurrence-policies` (public, stable). Verify in H-00 that the installed SDK exposes `recurrencePolicies()`; if not, record in `PROJECT-FINDINGS.md` and build the call through the SDK's generic request builder (no raw `fetch`).
6. Related: see 3.9.

Server caching summary: category tree, attribute labels, recurrence policies, channel list only. Price, inventory and availability are per request.

### 3.4 `ProductDetail` view model (`lib/mappers/product-detail.ts`, pure)

```ts
export interface VariantView {
  sku: string; id: number;
  attrs: Record<string, string | number | boolean>;   // enum key, number or boolean values only
  attrLabels: Record<string, string>;                 // localized labels of the selected enum values
  price: { value: Money; discounted?: Money; discountName?: string; tiers: { minimumQuantity: number; value: Money }[] } | null;
  recurring: { policyId: string; value: Money }[];    // recurrencePrices filtered to currency and country
  images: { url: string; alt: string }[];
  stock: { online: number; restockableInDays?: number; expectedDelivery?: string; minQty?: number; maxQty?: number; stores: Record<string, number> };
  unit?: { money: Money; perKey: 'capsule' | '100g' };
}
export interface ProductDetail {
  id: string; slug: string; name: string; categoryName: string; breadcrumb: { name: string; slug: string }[];
  tagline: string; description?: string;
  shape: 'pods'|'coffee'|'machine'|'accessory'|'gift';   // from product type key
  badge: ...; subscribable: boolean; rating: { average; count; distribution: Record<1|2|3|4|5, number> } | null;
  variants: VariantView[]; defaultSku: string;
  selectors: SelectorDef[];       // from variant-config, only attributes the product has with more than one value
  facts: { intensity?: number; roast?: string; origin?: string; notes: string[]; specs: { label: string; value: string }[] };
  systemKey?: string;             // pods and machines `system` enum key
}
```

Rules: `shape` from the product type key (`mcf-pods`, `mcf-coffee`, `mcf-machine`, `mcf-accessory`, `mcf-gift-set`). Attribute labels never hard-coded (skill: `getAttributeLabels`). `recurring` keeps only entries whose currency equals the session currency; a policy id with no match in the policy list is dropped. `price: null` when the variant has no selected price or the amount is 0. `rating.distribution` from `reviewRatingStatistics.ratingsDistribution` (keys 1..5, missing keys 0); null when `count` is 0.

**Variant config** (`lib/product/variant-config.ts`, edit config, never components; skill `b2c/variant-config.md`): per shape, selectors in order, renderer and whether required:

| Shape | Selectors (attribute name, renderer, required) | Info (not selectors) |
| --- | --- | --- |
| pods | `capsulesPerPack` (`pill`, label "10 sleeve / 50 box / 100 box" from a config map, required, default the smallest); `system` shown as a **selector only when the product page represents both systems** (seed: one system per product, so it is a read-only fact; the spec's "Machine system" selector is satisfied by linking to the sibling product, see Q-H-04) | `intensity`, `flavourNotes`, `origin`, `decaf`, `organic`, `fairtrade` |
| coffee | `sizeGrams` (`pill`, required, default 250), `grind` (`pill`, **required, no default**) | `roast` (fact), `origin`, `process`, `flavourNotes`, `intensity`, `brewMethods` |
| machine | `colour` (`colour`, required, default first), `bundle` (`pill`, required, default `machine-only`) | `system`, `pressureBar`, `waterTankMl`, `powerWatts`, `features`, `warrantyMonths` |
| accessory | `colour` (`colour`) when more than one value; none otherwise | `kind`, `material`, `capacityMl` |
| gift | none | `contents`, `occasion` |

A selector is shown only when the product has it **and** more than one distinct value. Blocklist: companion code attributes. Every info attribute is also in the blocklist (skill rule). Colour swatch fill from `lib/product/swatches.ts` (G) keyed by the enum key; unknown keys show a neutral swatch with the label as text.

### 3.5 Layout, gallery, buy box header

**Layout.** Breadcrumb (`Home › {category ancestors} › {name}`, locale `Link`s, current `aria-current`), then a grid `minmax(0, 1.05fr) minmax(0, 0.95fr)` with a 48px gap and `padding: 14px 0 64px`. At 900px and below: one column, gallery first, buy box second, thumbnails move **below** the main image as a horizontal row; the add button must be reachable without scrolling past the details (so the details accordions come after the add button, not before; at 390px the add button appears within two screens, verified in the recipe).

**Gallery** (`Gallery`, client): a column of 72x88 thumbnails (`button`s, 12px gap, selected 1px ink border, radius 10px) and a large image with `aspect-ratio: 5/6`, radius 24px (`--radius-xl`), `canvas-2` background; badge top-left (18px offset, same precedence as G's `badge.ts`), save heart top-right (`SaveButton` from G, 85% white circle, `aria-label` "Save"). Images come from the **selected variant**; if a variant has no images of its own the product master images are used (scenario "Variant imagery": choosing a colour swaps the set; the selected thumbnail resets to the first). Image URLs go through the detail and thumbnail transforms of `lib/ct/image-config.ts`; the first image loads with `priority`; others lazy. `alt` text from the image label or "{name}, view {n}". Keyboard: thumbnails are tab stops; Left/Right arrows move the selection; the main image is not interactive (no zoom in v1). Missing images: placeholder block with `pdp.noPhoto` (OA-x2). The "lifestyle shot and pack shot" ordering is data: the seed's first image is the pack shot (record in Q-H-09).

**Buy box header** (`BuyBoxHeader`): category (11px uppercase), name `h1` (Archivo 700, 34px, -0.02em, line-height 1.08), price row: current price (22px, 600), old price struck through and discount name when discounted, unit price (`pdp.unitPrice`: "{amount} per capsule" or "per 100 g"), rating (`Rating` atom, value to one decimal, count, anchor link to `#reviews`; no stars when no reviews, and a "Be the first to review" text link instead), then the tagline (15.5px `--ink-2`). The price shown is `effectiveUnitPrice(variant.price, quantity)` times nothing for the headline and `lineTotal` in the button (3.6). When the selection is incomplete the headline shows "From {lowest price in market}" (`pdp.priceFrom`). Scenario "Price follows the variant": changing pack size updates price and unit price synchronously (test uses `act` and no await).

### 3.6 Price, tiers, no price

`lib/product/price.ts` (pure, tested):
- `effectiveUnitPrice(price, quantity)`: when the price has `tiers` and no `discounted`, pick the tier with the greatest `minimumQuantity <= quantity` and return its value; **a discounted price ignores tiers** (docs: a Product Discount disables volume pricing). Otherwise `discounted?.value ?? value`. `lineTotal = unit * quantity` in integer minor units.
- The seed has no tiers (D-017, B2C excludes the tier table). The function and the scenario "Quantity crosses a tier" are still implemented and tested with fixtures so a market with tiers works; no tier table is rendered. The page shows only the unit price and line total that change at the boundary.
- **No price** (scenario "No price resolves"): when the selected variant has `price: null` the headline reads `pdp.priceOnRequest` ("Price on request"), the add button is disabled and reads the same state label, and no list price is shown. Subscribe and Collect cards are disabled with the same reason. Never fall back to another currency or to a list price.

### 3.7 Selectors, option states, compatibility

`OptionGroup` renders `option button`s (E's Option button atom: selected = ink fill, disabled = struck through with a muted fill, `title` stating why). Colour options render as 42px circles with the selected ring `2px canvas + 4px ink` (`ColourSwatches`, `role="radiogroup"`, each `role="radio"` with `aria-label` the colour name). Group label: "Size - 250 g" style, 13px 600, and a trailing link for the guide (Compatibility guide for pods and machines, Grind guide for coffee, ruler icon, opens `GuideModal`).

`resolveVariant(variants, selection)`: the variant whose `attrs` equal every selected value; `null` while a required attribute is unselected. `optionStates(variants, selection, ctx)` returns per option `{ value, disabled, reason? }` computed from the variants that match the **other** selections: disabled when no such variant exists; or when `fulfilment === 'collect'` and every matching variant has `stock.stores[storeChannelId] <= 0` (title `pdp.option.notAvailableForCollection` = "Not available for collection at this store", scenario "Variant out of stock at store"); or when no matching variant has a price (title `pdp.option.noPrice`). Out of stock **online** does not disable an option (the stated unavailability is shown by the button, scenario "Variant out of stock").

**Compatibility** (`lib/product/compatibility.ts`, scenario "Incompatible combination"): `podsFitMachine(machineSystem, podSystem)` is true for `original` with `original` and `vertuo` with `vertuo`, false otherwise; machine systems `bean-to-cup`, `espresso`, `filter` take no capsules. `bundleOffered(machineSystem, bundleKey)` returns false for `starter-capsules` when the machine takes no capsules; such an option is **rendered disabled** with title `pdp.option.bundleNotForMachine` ("Not offered for this machine") instead of being offered and rejected at the cart. The "Goes well with" strip uses the same function (3.9). The bundle "with milk frother" of the spec is not in the seed's `bundle` enum (machine-only, starter-capsules): the config lists only the enum values that exist (Q-H-06). The compatibility guide modal (E's Modal, 560px, 24px radius) shows a static table "Which capsules fit which machine" (rows Original, Vertuo, others "Does not use capsules") from catalogue strings, an "Original and Vertuo capsules are not interchangeable" note and a link to the pods categories; the grind guide shows a table grind to brew methods. Copy: SO-x1. Each modal has a close button, focus trap, Escape, focus returns to the opener.

### 3.8 Fulfilment, availability, add to bag

State owner `BuyBox` keeps: `selection`, `quantity` (1..`maxQuantity`, default 1), `fulfilment`, `policyId`. `maxQuantity` is the smaller of 99 and the variant's `maxCartQuantity` when set; `minQuantity` honours `minCartQuantity`. The stepper (`Stepper` atom, 38px targets, 16px icons) is a pill with `aria-label`s "Decrease quantity", "Increase quantity" and an `output` between.

**Cards** (`FulfilmentCards`, `radiogroup` "How would you like it?", two or three option cards in a grid `1fr 1fr` or `1fr 1fr 1fr`, selected: accent border plus inset 1px accent):
- **Collect** (icon store): "Free, ready in about {n} minutes" with n the chosen store's `collectionMinutes` (F), or "Choose a store" when none. Always rendered.
- **Ship**: "Free over {threshold}, 2 to 4 days" with threshold from F's `getFreeShippingThreshold` (spec: never a constant) and days from `lib/shop-config.ts` (`SHIP_DAYS_MIN`, `SHIP_DAYS_MAX`).
- **Subscribe and save**: "Deliver every {interval}, skip or cancel any time" plus the saving percentage computed from the cheapest recurring price vs the one-time price (`1 - recurring / oneTime`, rounded to a whole percent, shown only when positive). Rendered only when `product.subscribable` **and** the shape is not `machine` **and** `variant.recurring.length > 0` for the selected variant (skill gate; machines never offer it).
- Default fulfilment on load (Q-H-01): `collect` when a store is chosen and the landing variant is in stock there, otherwise `ship`.

**Collect block** (shown under the cards when Collect is selected): bordered `--surface` block, radius 16px, padding 14px 16px: status dot (9px) and text "In stock at {store}" (teal), "Low stock at {store}" (amber), or "Unavailable" (stone) plus the store; address line with distance (when known); "Ready today, in about {n} minutes" in teal with the clock icon only when stock exists and the store is open within the readiness window (otherwise "Ready on {next opening}" from `lib/hours.ts`, never a promise past closing); "Change" link that calls `useCollectionStore().open({ sku })` (the picker then shows per-store availability lines). No store chosen: the block asks "Choose a store to see availability" with a primary button that opens the picker. Status derives from `stock.stores[channelId]` of the **resolved variant** through F's `availabilityState`; while the selection is incomplete it uses the landing variant.

**Ship block**: truck icon, `deliveryEstimate(now, { cutoffHour, timeZone, minDays, maxDays })` renders "Order in the next {h} hours for delivery by {day}" before the cut-off, otherwise "Order now for delivery by {day}" (weekday names localized with `Intl.DateTimeFormat`, skipping Saturday and Sunday; same estimate for every address because commercetools has no per-address estimate, template open question; Q-H-02). Online stock out: the block says "Out of stock online", with "Back in about {n} days" from `restockableInDays` or "Expected {date}" from `expectedDelivery` when the inventory record carries them (scenario "Variant out of stock"), otherwise just "Out of stock online".

**Subscribe block**: interval `select` of the policies that have a recurring price for the selected variant (policy label from `formatInterval(schedule)`: "Every 2 weeks", "Every month", "Every 2 months", "Every 3 months"; the helper handles singular and plural unit names), the recurring price per delivery and the one-time price struck for comparison, one line "Skip or cancel any time in your account". Policies without a price for this variant are not offered (skill). `policyId` defaults to the first policy.

**Add button** (`AddToBag`, `addButtonState` pure). Label keys, in priority order:
1. required selection missing: `pdp.add.select` ("Select a {choice}", the choice is the first unselected required selector's label; scenario "Required choice missing"), disabled;
2. no price: `pdp.add.priceOnRequest`, disabled;
3. fulfilment `collect`, no store: `pdp.add.chooseStore`, enabled, opens the picker;
4. fulfilment `collect`, stock at store 0 (or below the chosen quantity): `pdp.add.unavailableCollect` ("Unavailable for collection"), disabled (scenario "Out of stock for collection": switching to Ship re-enables it);
5. fulfilment `ship` or `subscribe` with online stock 0: `pdp.add.outOfStock`, disabled;
6. fulfilment `collect`: `pdp.add.reserve` ("Reserve for collection"); `ship`: `pdp.add.addToBag` ("Add to bag"); `subscribe`: `pdp.add.subscribe` ("Subscribe").
Enabled labels are suffixed with the line total ` - {formatMoney(lineTotal)}` (subscribe uses the recurring unit). Large pill button (E `Button` lg, block), 40% opacity when disabled, 0.985 press scale. When the chosen quantity exceeds stock, the stepper clamps to the available quantity of the active fulfilment and a hint shows `pdp.qty.limit` ("Only {n} available").

**Add action**: `useAddToCart().add({ sku, quantity, fulfilment, storeKey?, recurrencePolicyKey? })` calls `POST /api/cart/lines` (3.10); success: `toast.show(t('shell.toast.added'))` (collect lines say `pdp.toast.reserved` "Reserved for collection"), the header count updates (`mutate(KEY_CART_COUNT)`), nothing opens or navigates; errors map to inline text near the button: `409 not_available_for_collection` refreshes stock and shows `pdp.error.collectGone`, `422 price_unavailable`, `409 conflict`, generic. Pending: button shows a spinner and is `aria-busy`.

**Store change behaviour**: `BuyBox` subscribes to `useCollectionStore().store?.key` and calls `router.refresh()` when it changes so the server re-reads inventory for the new store; during the refresh the old values stay and the collect block shows a skeleton line.

### 3.9 Trust row, accordions, rating summary, related

- **Trust row** (under the button): three items, 12.5px `--ink-3` with icons repeat/shield/leaf: "{days}-day returns" (`RETURN_DAYS` from F, never the prototype's 90), "Quality guarantee", "Responsibly sourced".
- **Accordions** (`DetailAccordions`, `Accordion`): "Details" (open by default), "Brewing and care", "Shipping and collection". Header is a `button` with `aria-expanded`/`aria-controls`, chevron right to down, content entrance 10px translate (disabled with reduced motion). Details: description paragraph, then the shape's facts (attributes from `PDP_INFO_ATTRIBUTES`, values in plain text blocks, labels from attribute labels) such as origin, flavour notes, roast, intensity (and for machines the specifications list). Brewing and care: static, per shape, from catalogue keys (descaling, storage, capsule recycling for pods and machines; grinding and brewing tips for coffee) signed off in SO-x1. Shipping and collection: dynamic sentence with the market's threshold, collection minutes and return days.
- **Facts row**: intensity as a 13-segment bar (`role="img"` `aria-label` "Intensity 8 of 13"), flavour notes as chips, roast as a labelled dot scale (light, medium, dark) read-only.
- **Rating summary** (`RatingSummary`, server): average and count from statistics and a 5 to 1 star distribution bar chart (bars width = share, with counts); no data renders "Be the first to review". It sits inside `<section id="reviews">` followed by `ReviewsSlot`, which renders M's `ReviewsSection` when `components/reviews/ReviewsSection` exists (dynamic import guarded by a build-time flag `REVIEWS_ENABLED` in `lib/shop-config.ts`, default false until M) and a text "Reviews will appear here" otherwise is **not** shown: the slot renders nothing until M, to avoid fake content.
- **Related** (`getRelatedProducts(product, ctx)` in `lib/related.ts`): "You may also like" always four cards (G's `ProductCard`): (1) `searchProducts` with `categoriesSubTree` = the product's deepest category, limit 5, drop itself; (2) if fewer than four, repeat with the root category (limit 8) and merge without duplicates; (3) if still fewer, bestsellers (`f_collection=bestseller` clause) fill the rest. Uses the same market filter as G. Machines: before it, a "Goes well with" strip of up to four capsule cards: `searchProducts` with category subtree `mcf-cat-pods` and `exact variants.attributes.system.key = machine system` (only for systems that take capsules; scenario "Machine": compatible capsules lead the list). The strip is omitted when no capsule matches.

### 3.10 Cart contract extension (G created it; H adds the branches)

`POST /api/cart/lines` request `{ sku, quantity, fulfilment: 'ship'|'collect'|'subscribe', storeKey?, recurrencePolicyKey? }`; response `200 { cart: CartSummary }`.
- **ship**: as G.
- **collect** (requires `storeKey`): validate the key against F's channel list for the session country (`400 unknown_store`); read the inventory entry `where: 'sku="<sku>" and supplyChannel(id="<channelId>")'` and require `availableQuantity >= quantity` (`409 not_available_for_collection`, with `{ available }` in the error details); `addLineItem` with `{ sku, quantity, supplyChannel: { typeId: 'channel', id }, custom: { type: { typeId: 'type', key: 'mcf-line-fulfilment' }, fields: { fulfilment: 'collect' } } }` (skill: the supply channel reference is an object, never a string). Different stores or a ship line of the same sku are different lines because `supplyChannel` differs.
- **subscribe** (requires `recurrencePolicyKey`): resolve the policy by key (`apiRoot.recurrencePolicies().withKey({ key }).get()`, `400 unknown_policy`), verify the variant has a recurring price for that policy id in the session currency and country (else `422 price_unavailable`), then `addLineItem` with `recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy', id }, priceSelectionMode: 'Fixed' }` and fulfilment `subscribe`. The SDK type may lack `recurrenceInfo`; cast the whole action once at the call site (skill `b2c/optional/recurring-prices.md`) and keep it in one function `buildAddLineAction`. One-time lines never include `recurrenceInfo` (not even `undefined`). A recurring line of the same sku and policy merges (the platform merges identical line items).
- `GET /api/recurrence-policies` returns `200 { policies: RecurrencePolicyView[] }` (public, cacheable; `Cache-Control: public, max-age=300`).

### 3.11 Session, cache keys, i18n, states

**Session**: reads `country`, `currency`, `locale`, `collectionStoreKey`, `cartId`, `anonymousId`; writes `cartId` and `anonymousId` through G's cart core. **Cache keys**: `KEY_RECURRENCE_POLICIES = 'recurrence-policies'`, `keyAvailability(sku)` (F), `KEY_CART`, `KEY_CART_COUNT` (G, F). Server tags `recurrence-policies`, `categories`, `attribute-labels`.

**i18n keys** (identical in the three catalogues): `pdp.breadcrumb.home`, `pdp.noPhoto`, `pdp.thumb.aria`, `pdp.priceFrom`, `pdp.unitPrice.capsule|100g`, `pdp.priceOnRequest`, `pdp.rating.firstReview`, `pdp.selector.<attr>` (labels from attribute definitions where present, catalogue only for UI words "Size", "Grind", "Colour", "Pack", "Bundle"), `pdp.selector.choose` ("Choose a {choice}"), `pdp.guide.compat.link|title|intro|table.*|note`, `pdp.guide.grind.link|title|table.*`, `pdp.option.notAvailableForCollection|noPrice|bundleNotForMachine`, `pdp.fulfil.title` ("How would you like it?"), `pdp.fulfil.collect.title|line|choose`, `pdp.fulfil.ship.title|line`, `pdp.fulfil.subscribe.title|line|saving`, `pdp.collect.in|low|out|ready|readyOn|change|chooseStore|distance`, `pdp.ship.before|after|outOnline|backInDays|expected`, `pdp.subscribe.interval|every|skipCancel|price`, `pdp.add.select|priceOnRequest|chooseStore|unavailableCollect|outOfStock|reserve|addToBag|subscribe`, `pdp.qty.decrease|increase|limit`, `pdp.toast.reserved`, `pdp.error.collectGone|price|conflict|generic`, `pdp.trust.returns|quality|sourced`, `pdp.acc.details|brewing|shipping`, `pdp.facts.intensity|notes|roast|origin`, `pdp.care.pods|coffee|machine|accessory`, `pdp.shipping.text`, `pdp.rating.summary|distribution`, `pdp.related.title` ("You may also like"), `pdp.related.goesWith` ("Goes well with"), `pdp.error.title|retry`. English default texts are given in the spec; German is written and signed off (SO-x1).

**States**: loading `loading.tsx` renders the two-column skeleton (gallery block 5:6, text lines) with no layout jump; unknown sku or product without a published projection is `notFound()`; inventory failure: the page still renders with an unobtrusive "Stock could not be checked" note and Collect/Ship add buttons disabled with `pdp.error.generic` (never claim stock); policy failure: Subscribe card hidden; related failure: strip omitted. A product with a price in no market shows the page with price on request (not a 404).

**Responsive**: 1080px: no change except the related grid to 3; 900px: one column, thumbnails below the image as a scrolling row; 820px: padding 20px; 520px: stepper and button wrap on two rows (button full width), fulfilment cards stack in one column when three are shown. **Accessibility**: one `h1`; selectors are `radiogroup`s with roving focus; disabled options keep `aria-disabled` and the `title` text is also available as `aria-describedby`; the add button state changes announce in a polite live region; modals trap focus; the intensity bar and rating have text alternatives; focus ring everywhere; colour never the only signal (status text plus dot).

## 4. Tasks

Common rules as in G. Each task ends with `npm run check`; commit `ws-h: H-0x ...`.

- [ ] **H-00 Preconditions.** With the MCP or a read-only script confirm: the seeded product types and attribute names of SEED-PLAN section 6 exist; a pod, a coffee, a machine and an accessory product with several variants; inventory entries per variant online and per store; `recurrencePrices` on a subscribable variant; the SDK exposes `recurrencePolicies()`; `lineItem.custom` type key `mcf-line-fulfilment`; `addLineItem` with `supplyChannel`, with `recurrenceInfo` against the live project (create the cart through the app, read back with the MCP). Save `plans/evidence/H/mcp-checks.md`; findings to `PROJECT-FINDINGS.md`. [SKILL: commercetools-storefront] [SKILL: commercetools-platform]
- [ ] **H-01 Product read and mapper.** `lib/ct/product-detail.ts`, `lib/ct/inventory.ts#getInventoryDetail`, `lib/mappers/product-detail.ts`, `lib/pdp/load.ts` (React `cache()`), `lib/product/variant-config.ts`. [SKILL: commercetools-storefront] Tests: `sku lookup uses Product Search then the projection with the same price context`, `invalid sku is not found before any call`, `recurring prices filtered by currency and country`, `distribution from ratings statistics`, `price null for zero or missing`, `selectors only for attributes with more than one value`, `info attributes are not selectors`, `inventory detail maps online and store entries and restock fields`, `unknown product returns null`, `metadata and page share one cached load`.
- [ ] **H-02 Pure helpers.** `resolve-variant.ts`, `price.ts`, `compatibility.ts`, `delivery.ts`, `add-state.ts`. Tests: `Price follows the variant`, `Quantity crosses a tier` (unit price and total change at the boundary), `promotion disables volume tier`, `No price resolves is not added and has no fallback`, `Incompatible combination bundle is disabled not offered`, `pods fit only the same system`, `Required choice missing reads Select a grind`, `Out of stock for collection disables with the label and Ship re-enables`, `Variant out of stock at store disables the option with the title`, `delivery estimate skips weekends and respects the cut-off`, `add label includes line total only when enabled`.
- [ ] **H-03 Route, metadata, layout shell.** `app/[locale]/p/[slug]/[sku]/page.tsx`, `loading.tsx`, `ProductDetail`, breadcrumb, canonical redirect, `generateMetadata` (title `metaTitle ?? name`, description `metaDescription ?? description`, same cached load). Tests: `canonical slug redirects permanently`, `unknown sku 404`, `metadata uses the same market context`, `Mobile order is gallery then buy box then details` (DOM order).
- [ ] **H-04 Gallery.** `Gallery` with variant imagery, thumbnails, badge, heart. Tests: `Variant imagery swaps with the colour`, `falls back to master images`, `arrow keys move selection`, `placeholder when no images`, `first image has priority`, `no axe violations`.
- [ ] **H-05 Buy box header, facts, selectors, guides.** `BuyBoxHeader`, `OptionGroup`, `ColourSwatches`, `FactsRow`, `GuideModal`, selection to URL sync. Tests: `Price follows the variant`, `selectors per shape` (pods, coffee, machine, accessory fixtures), `colour ring and aria`, `selection mirrored with replaceState and restored from the URL`, `choose param highlights the selector`, `guide modals trap focus and return it`, `intensity bar text alternative`.
- [ ] **H-06 Fulfilment cards and blocks.** `FulfilmentCards`, `CollectBlock`, `ShipBlock`, `SubscribeBlock`, `GET /api/recurrence-policies`, `hooks/useRecurrencePolicies.ts`, store change refresh. [SKILL: commercetools-storefront] Tests: `Subscribe appears only for subscribable non-machine variants with a recurring price`, `machines never offer subscribe`, `Collect at an empty store shows Unavailable and ship stays available`, `collect block shows status address ready line and Change`, `no store asks to choose a store`, `ship estimate before and after cut-off`, `policies without a price are not offered`, `interval label singular and plural`, `store change triggers refresh`, `recurrence policies endpoint is public cached`.
- [ ] **H-07 Add to bag and cart branches.** `AddToBag`, stepper, `lib/ct/cart.ts` collect and subscribe branches, `POST /api/cart/lines` validation, `useAddToCart` fulfilment arguments. [SKILL: commercetools-storefront] Tests: `Reserve adds a collect line with the store as supplyChannel and the fulfilment field` (scenario "Reserve", spec "Collect line"), `collect rejects an unknown store and an empty store`, `subscribe attaches recurrenceInfo Fixed and fulfilment subscribe`, `one-time line has no recurrenceInfo key`, `subscribe rejects a policy without a price`, `toast and header count update`, `quantity clamps to stock and min and max cart quantity`, `409 not_available_for_collection refreshes and explains`, `different stores make different lines`, `stepper minimum is 1`.
- [ ] **H-08 Trust row, accordions, rating summary, reviews slot.** Components per 3.9. Tests: `Accordion toggles with chevron and animation class` (disabled under reduced motion), `Details open by default`, `trust row uses the market return days`, `shipping text uses the live threshold and minutes`, `rating summary shows average count and distribution`, `no reviews offers Be the first to review`, `reviews slot renders nothing until M`.
- [ ] **H-09 Related and goes-well-with.** `lib/related.ts`, `RelatedStrip`. Tests: `You may also like is same category first filled to four`, `drops the product itself`, `bestsellers fill the remainder`, `Machine page leads with compatible capsules`, `machines that take no capsules have no strip`, `related failure omits the strip`.
- [ ] **H-10 Messages, states, gates.** Catalogues for 3.11, `loading.tsx` skeleton, inventory-failure behaviour, `npm run check`, `npm run build`; confirm the route is dynamic.

## 5. Scenarios checklist

`design-product-detail-page`:
- [ ] Mobile (gallery first, buy box second, add reachable): `H-03` `Mobile order...`, browser step 9
- [ ] Variant imagery: `Gallery` test `Variant imagery swaps with the colour`
- [ ] Price follows the variant: `H-02`/`H-05` `Price follows the variant`
- [ ] Required choice missing: `H-02` `Required choice missing reads Select a grind`
- [ ] Incompatible combination: `H-02` `Incompatible combination bundle is disabled not offered`
- [ ] Out of stock for collection: `H-02` and `H-06`
- [ ] Variant out of stock at store: `H-02` `...disables the option with the title`
- [ ] Reserve: `H-07` `Reserve adds a collect line...`
- [ ] Accordion: `H-08` `Accordion toggles...`
- [ ] Machine (related): `H-09` `Machine page leads with compatible capsules`

`product-detail-page` (template):
- [ ] Quantity crosses a tier: `H-02` `Quantity crosses a tier`
- [ ] No price resolves: `H-02` `No price resolves...` and `H-05` render test
- [ ] Variant out of stock (with restock information): `H-06` ship block test `outOnline backInDays expected`

`fulfilment-and-availability-model` (H part):
- [ ] Collect at an empty store: `H-06`
- [ ] Collect line (supplyChannel and `fulfilment = collect`): `H-07`
- [ ] Subscriptions gate (subscribe only where a recurring price exists): `H-06`; line gets `recurrenceInfo`: `H-07`

`reviews-and-ratings` (extended): Card/page rating and No reviews ("Be the first to review"): `H-08`.

## 6. Browser recipe (Chrome DevTools MCP; base `http://localhost:3000`; evidence `plans/evidence/H/`)

Seeded project, US session, viewports 375x812 and 1440x900; console and network clean after each step; never a request to a commercetools host.
1. From `/en-US/category/<pods>` open a pod card. URL is `/en-US/p/<slug>/<sku>`. Snapshot: breadcrumb, gallery (3 thumbs or placeholder), name, price, unit price "per capsule", rating, system fact, intensity bar, flavour chips, pack selector (10/50/100), fulfilment cards, add button label. Screenshot `H-01-pdp-pods-1440.png`.
2. Change the pack: price and unit price change at once (no network request, URL gets `?capsulesPerPack=50` through replaceState, check with `evaluate_script(location.href)`).
3. Choose a store through "Change": Collect block shows status and "Ready today, in about {n} minutes" for an in-stock store; choose a store where this SKU is 0 (from MCP): block says Unavailable, the button reads "Unavailable for collection" and is disabled, the 50-pack option behaves per stock, switch to Ship: button reads "Add to bag" and is enabled. Screenshots `H-02-collect-1440.png`, `H-03-unavailable-1440.png`.
4. Coffee page: add button reads "Select a grind" and is disabled; choose a grind: enabled with the line total; the size option shows the 1 kg price. From a card Quick add on coffee lands here with `?choose=grind` and the grind group highlighted.
5. Machine page: colour swatches change the gallery images; bundle options include "starter capsules" for an Original/Vertuo machine and show it disabled with the title for a bean-to-cup machine; "Goes well with" strip shows capsules of the same system first. Screenshot `H-04-machine-1440.png`.
6. Subscribe: on a subscribable pod the third card appears; choose an interval, price shows the recurring amount; press Subscribe: toast "Added to bag", header badge +1. A machine page has no Subscribe card.
7. Add as Collect: press "Reserve for collection": toast, badge +1. Read the cart with the MCP (section 7).
8. No price: open a product in a market without a price for it (find one with the MCP; if none exists use a price-less SKU created by the seed request and record): the page says "Price on request" and the button is disabled.
9. 375 viewport: gallery, then buy box, thumbnails below the image; scroll to the add button: reachable within two screens; fulfilment cards stack; guide modal opens and traps focus. Screenshots `H-05-pdp-375.png`, `H-06-guide-375.png`.
10. Related: "You may also like" shows four cards; open one, the page changes and focus/scroll reset. Keyboard: Tab order gallery, selectors, cards, button; Enter on a thumbnail changes the image. `/de-DE/p/...` shows German and EUR; `view-source` shows the canonical `link` and the title from product data.

## 7. Self-verification with data

MCP or `cd seed && npm run verify` or a read-only script; record trimmed results in `plans/evidence/H/mcp-checks.md`.
- Variants: for the sample pod, coffee, machine and accessory list `variants` attributes and compare with the selectors rendered.
- Price: the displayed price equals the embedded price for the variant, currency and country (USD/US, EUR/DE, GBP/GB) and the discounted amount when a product discount exists; the line price after add equals it.
- Inventory: pick a SKU with a store at 0 and one in stock; the collect block status equals `read_inventory` for that `supplyChannel`; online stock decides Ship.
- Recurring: a subscribable variant has `recurrencePrices` for each seeded policy; the interval list equals the policies having a price; after Subscribe, `read_carts` shows `recurrenceInfo.recurrencePolicy.id` and `priceSelectionMode: Fixed`.
- Cart lines after steps 6 and 7: the collect line has `supplyChannel.id` equal to the chosen store channel and `custom.fields.fulfilment = collect`; the ship/subscribe lines have no supply channel and the right fulfilment value; the subscribe line's `price` is the recurring price.
- Ratings: `reviewRatingStatistics` of two products equals the page's average, count and distribution.

## 8. Manual testing and owner items

Rows (also in `plans/notes/todo-H.md`):

| Id | Who | When | Steps | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| OA-x2 | Owner | Before images appear on the page | As OA-03 (`IMAGE_SOURCE_URL`, then `seed:images`) | Gallery shows photos instead of the placeholder | TODO |
| SO-x1 | Owner | Before release | 1. Read `pdp.guide.*`, `pdp.care.*`, `pdp.trust.*`, `pdp.priceOnRequest` in `messages/en-US.json` and the German file. 2. Confirm the compatibility table (Original vs Vertuo, no capsules for bean-to-cup/espresso/filter) and the grind to brew table. | Copy and facts approved | TODO |
| SO-x2 | Owner | Before release | Decide the delivery estimate rule: cut-off hour (default 14:00 local), delivery days 2 to 4 business days, weekends skipped | Rule confirmed or changed in `lib/shop-config.ts` | TODO |
| M-H-01 | Owner | After H | 1. On a real phone open a pod, a coffee and a machine page. 2. Compare with `design/export/.../screenshots/pdp.png` and `01-pdp2.png`. 3. Check that the add button is reachable and the guide modals read well. | Visual fidelity and flow acceptable | TODO |
| M-H-02 | Owner | After H | 1. On a real phone choose a store, reserve a pod for collection, then switch the same product to Ship and add. 2. Open the bag. | Two separate lines (completed by I) | TODO |

## 9. Questions

Mirrored in `plans/notes/questions-H.md`.

1. **Q-H-01** Default fulfilment on load. Default: collect when a store is chosen and the variant is in stock there, else ship (the prototype defaults to pickup).
2. **Q-H-02** Delivery estimate before a cart exists (template open question). Default: a market-wide rule (cut-off hour, 2 to 4 business days) in `lib/shop-config.ts`, same for every address.
3. **Q-H-03** Datasheets and safety data sheets (template open question): not applicable to a B2C coffee shop. Default: none shown.
4. **Q-H-04** The spec shows "Machine system" as a pod selector, but each seeded pod product belongs to one system. Default: system is a read-only fact on the page plus a link "Also available for Vertuo/Original" to the sibling product when one exists with the same name stem (matched by product key convention `<name>-original` and `<name>-vertuo`); no selector.
5. **Q-H-05** Price tiers: the template requires the scenario, B2C excludes the tier table, the seed has no tiers. Default: implement tier-aware unit price and total without a table; test with fixtures.
6. **Q-H-06** The spec lists the bundle "with milk frother" but the seed `bundle` enum has only machine-only and starter-capsules. Default: show the enum values that exist; seed request for the third value.
7. **Q-H-07** Subscribe saving percentage: computed from prices (recurring vs one-time) or fixed copy "10%"? Default: computed per variant, shown only when positive.
8. **Q-H-08** Quantity limits: honour inventory `minCartQuantity`/`maxCartQuantity`, otherwise 1 to 99. Default as stated.
9. **Q-H-09** Image order: "pods and machines include a lifestyle shot and a pack shot". Default: first image is the pack shot, others follow; the seed images are assigned round-robin so the order is not curated (OA-03).
10. **Q-H-10** Selection state in the query string with `replaceState` (back leaves the page) versus pushing a history entry per option. Default: replace.
11. **Q-H-11** Show the PDP for a product with no price in the market (price on request) or 404? Default: show, per the template scenario; G hides such products from lists.
12. **Q-H-12** Should adding a line open the cart drawer? Default: no, toast only (spec).
13. **Q-H-13** Is the machine/capsule compatibility rule (Original with Original, Vertuo with Vertuo) final, and do other machine systems take any capsule? Default: only those two pairs; owner confirms in SO-x1.

## 10. Definition of done

- H-00 to H-10 ticked with passing `npm run check`; `npm run build` passes; the route is dynamic.
- Every scenario in section 5 has a named passing test or recorded evidence.
- Browser recipe walked at 375 and 1440 with evidence in `plans/evidence/H/` (screenshots named above, `mcp-checks.md`, `README.md`); console and network clean; cart reads verified with the MCP.
- Exported and described in header comments for I, K, M, N and O: `loadProductPage`, `mapProductDetail`, `effectiveUnitPrice`, `resolveVariant`, `podsFitMachine`, `buildAddLineAction`, `POST /api/cart/lines` (all three fulfilment values), `GET /api/recurrence-policies`, `useRecurrencePolicies`, `formatInterval`.
- No hex values, no `any`, no bare `next/link`; `grep -rn "variant.availability" components lib/pdp` returns nothing (inventory read only).
- OA-x2, SO-x1, SO-x2, M-H-01, M-H-02 in `plans/notes/todo-H.md`; questions Q-H-01 to Q-H-13 in `plans/notes/questions-H.md`; seed gaps in `plans/notes/seed-requests.md`.
- `STATUS.md` set to `Ready for review`.

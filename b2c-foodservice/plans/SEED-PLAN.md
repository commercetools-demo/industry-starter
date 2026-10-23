<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Seed plan: the Malva Coffee platform data

The seed package `seed/` builds everything below, idempotently, keyed `mcf-*`. Contract: `openspec/specs/platform-project-setup-and-seed`. All amounts are examples a designer can change; the structure is the commitment. Anything marked **(default)** is open in `QUESTIONS.md`.

## 0. Project settings

- `changeProductSearchIndexingEnabled` (mode `ProductsSearch`) on, wait for `Activated`.
- `changeCountryTaxRateFallbackEnabled` true.
- Countries US, CA; currencies USD, CAD; languages en-US, en-CA. Add only (the project may already hold others; nothing is removed).
- The live project already has `changeCountryTaxRateFallbackEnabled` true; the Product Search indexing and the CA, CAD, en-CA additions are applied by `seed:settings` or by an owner-approved permission rule for `mcp__food-service__update_project` (see `STATUS.md`).

## 1. Sample-data cleanup (before the seed)

`seed:inventory` reads products, product types, categories, prices, discounts and codes, shipping methods, zones, tax categories, channels, custom types, recurrence policies, states, shopping lists, customers and writes `seed/cleanup-manifest.json` (type, key or id, name, count per type; git-ignored). A human or lead reviews it. `seed:cleanup -- --manifest <file> --confirm <projectKey>` deletes the listed entries in dependency order. Orders and carts cannot be deleted through the API; they stay (D-019). Entries with `mcf-` are refused.

## 2. Tax

| Category (key) | US | CA |
| --- | --- | --- |
| `mcf-tax-food` (pods, coffee) | 0% | 0% (zero-rated) |
| `mcf-tax-standard` (machines, accessories, gifts) | 8% country fallback; NY 8.875% | 5% GST |

Rates accepted by the owner (D-036). Prices in both markets are tax-exclusive. Canada has no provincial tax modelled (HST/PST are not built; noted for an accountant). Not tax advice.

## 3. Zones and shipping

Zones `mcf-zone-us`, `mcf-zone-ca`. Standard carrier only (D-034); methods per zone with a rate per currency and a free-above tier:

| Method key | US (USD) | CA (CAD) |
| --- | --- | --- |
| `mcf-ship-standard` | 6.95, free from 75 | 8.95, free from 99 |
| `mcf-ship-express` | 14.95 | 18.95 |
| `mcf-collect` | 0 | not offered |

`mcf-collect` is the method that goes with collection lines (`fulfilment-and-availability-model`); it exists in the US zone only because all six stores are in New York City (D-035). The Canada market is delivery only. Standard and express are both carrier rates (D-034 excludes timed slots).

## 4. Custom types and states

- Line item type `mcf-line-fulfilment`: field `fulfilment` enum `collect|delivery|subscribe`.
- Channel type `mcf-store`: `addressLine`, `city`, `postalCode`, `phone`, `hours` (text, JSON by weekday), `collectionMinutes` (number).
- Order states (type `OrderState`): `mcf-order-ordered` (initial), `mcf-order-preparing`, `mcf-order-ready-for-collection`, `mcf-order-collected`, with transitions in that order. These keys are in `CONTRACT_KEYS`.
- No review states (D-037, no moderation): a review with no state is included in statistics at once. The seed creates none.

## 5. Stores (supply channels, role `InventorySupply`)

| Key | City | Country |
| --- | --- | --- |
| `mcf-store-nyc-soho` | New York, SoHo | US |
| `mcf-store-nyc-brooklyn` | New York, Brooklyn | US |
| `mcf-store-nyc-upper-west` | New York, Upper West Side | US |
| `mcf-store-nyc-chelsea` | New York, Chelsea | US |
| `mcf-store-nyc-williamsburg` | New York, Williamsburg | US |
| `mcf-store-nyc-astoria` | New York, Astoria | US |

All six stores are in New York City (D-035); collection is a US-market feature and Canada shows no store picker. Final keys follow the seed package. Addresses are invented streets in real NYC neighbourhoods; coordinates in `geoLocation`. Hours differ per store (some close Sundays).

## 6. Product types (attributes)

| Key | Attributes |
| --- | --- |
| `mcf-pods` | `system` enum (original, vertuo), `intensity` number 1 to 13, `roast` enum, `flavourNotes` set of localized text, `origin` text, `decaf`, `organic`, `fairtrade` booleans, `capsulesPerPack` number (variant) |
| `mcf-coffee` | `roast` enum, `origin` text, `process` text, `flavourNotes`, `intensity`, `decaf`, `organic`, `fairtrade`, `brewMethods` set enum (espresso, filter, french-press, moka, cold-brew), variant `sizeGrams` number, variant `grind` enum (whole-bean, espresso, filter, french-press, moka) |
| `mcf-machine` | `system` enum (original, vertuo, bean-to-cup, espresso, filter), `pressureBar`, `waterTankMl`, `powerWatts`, `features` set text, `warrantyMonths`, variant `colour` enum, variant `bundle` enum (machine-only, starter-capsules) |
| `mcf-accessory` | `kind` enum (cup, mug, frother, descaler, storage, grinder-accessory), `material`, `capacityMl`, variant `colour` |
| `mcf-gift-set` | `contents` text, `occasion` enum |

Each product also has `badge` enum (none, bestseller, new, limited-edition) and `subscribable` boolean as product-level attributes so listing filters work.

## 7. Categories

`mcf-cat-pods` (children `-original`, `-vertuo`), `mcf-cat-coffee` (`-beans`, `-ground`, `-single-origin`, `-blends`), `mcf-cat-machines` (`-capsule`, `-bean-to-cup`, `-espresso`, `-filter`, `-grinders`), `mcf-cat-accessories` (`-cups-mugs`, `-frothers`, `-care`, `-storage`), `mcf-cat-gifts`. Slugs per language (en-US, en-CA); order hints; images from the image file.

## 8. Products (about 40)

12 pod products (6 Original, 6 Vertuo; variants 10, 50 and 100 capsules), 10 coffees (variants size 250 g and 1 kg crossed with grinds), 8 machines (colour and bundle variants), 8 accessories, 3 gift sets, plus 3 products with no reviews and 2 out of stock at one store so empty states are testable. Names, descriptions and attributes in en-US and en-CA (en-CA may reuse the en-US text with Canadian spelling where it differs). The pods are described as "compatible with Nespresso Original" or "...Vertuo" (D-005).

## 9. Prices

Embedded prices per variant: one each for US/USD and CA/CAD. USD base table in `seed/src/data/prices.ts`; CAD about 1.35 of USD rounded to a sensible `.x0` or `.x5` amount; both are tax-exclusive. A few variants carry a product discount price. Subscribable pods and coffee also get `recurrencePrices` for each recurrence policy at 10% below the one-time price.

## 10. Recurrence policies

`mcf-every-2-weeks`, `mcf-every-month`, `mcf-every-2-months`, `mcf-every-3-months` (`schedule`: standard, `intervalUnit` Weeks or Months, `value`).

## 11. Inventory

One entry per variant without a channel (online) and one per store channel, quantities deterministic from the SKU and store key so every run is the same; a handful at 0 and a few under the low-stock threshold.

## 12. Discounts

Cart discounts with codes (stackable): `WELCOME10` 10% off, `FREESHIP` free standard shipping, `COFFEE15` 15 off over 60 (USD; CAD amounts for Canada). One automatic product discount for a seasonal sale on selected machines. Keys `mcf-discount-*`; codes are the code strings.

## 13. Customers

Six demo customers, created already verified (no email exists, D-032), with default shipping and billing addresses in their market, password from `SEED_DEMO_PASSWORD` (at least 10 characters): `maya.okonkwo@example.com`, `liam.carter@example.com`, `noah.patel@example.com` (US), and three Canadian customers `priya.nair`, `lucas.tremblay`, `ava.mackenzie` (all `@example.com`). One customer has a saved-items shopping list `mcf-saved-maya`.

## 14. Reviews

3 to 12 published reviews per top product (no moderation, D-037), written by the demo customers, ratings spread 1 to 5 with a realistic skew, keyed `mcf-review-<sku>-<n>`. Verified-purchase links need orders, which the seed does not create (Q-C-04).

## 15. Images

`seed:images` reads `IMAGE_SOURCE_URL` (provided by the owner later, OA-03), takes `pageProps.initialData.data[].attributes.image.download_link` (fallback `large`), strips query and fragment, records width, height and description in `seed/src/data/images.json`. `seed` assigns images to products and categories round-robin by tag match (coffee, capsule, machine, cup) and adds them to existing products on re-run.

## 16. Verification

`npm run verify` reads settings, per-type counts, one sample of each type, review statistics against seeded reviews, prices against the table, inventory against the rule, and exits non-zero on any mismatch. The unit tests run the same checks against the in-memory fake API.

<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Seed plan: the Malva Coffee platform data

The seed package `seed/` builds everything below, idempotently, keyed `mcf-*`. Contract: `openspec/specs/platform-project-setup-and-seed`. All amounts are examples a designer can change; the structure is the commitment. Anything marked **(default)** is open in `QUESTIONS.md`.

## 0. Project settings

- `changeProductSearchIndexingEnabled` (mode `ProductsSearch`) on, wait for `Activated`.
- `changeCountryTaxRateFallbackEnabled` true.
- Countries US, DE, GB; currencies USD, EUR, GBP; languages en-US, en-GB, de-DE. Add only.

## 1. Sample-data cleanup (before the seed)

`seed:inventory` reads products, product types, categories, prices, discounts and codes, shipping methods, zones, tax categories, channels, custom types, recurrence policies, states, shopping lists, customers and writes `seed/cleanup-manifest.json` (type, key or id, name, count per type; git-ignored). A human or lead reviews it. `seed:cleanup -- --manifest <file> --confirm <projectKey>` deletes the listed entries in dependency order. Orders and carts cannot be deleted through the API; they stay (D-019). Entries with `mcf-` are refused.

## 2. Tax

| Category (key) | US | DE | GB |
| --- | --- | --- | --- |
| `mcf-tax-food` (pods, coffee) | 0% **(default)** | 7% | 0% **(default)** |
| `mcf-tax-standard` (machines, accessories, gifts) | 8% country fallback; NY 8.875% | 19% | 20% |

US prices are tax-exclusive; DE and GB prices are tax-inclusive. Not tax advice; the owner confirms (Q-B-03).

## 3. Zones and shipping

Zones `mcf-zone-us`, `mcf-zone-de`, `mcf-zone-gb`. Methods per zone with a rate per currency and a free-above tier:

| Method key | US (USD) | DE (EUR) | GB (GBP) |
| --- | --- | --- | --- |
| `mcf-ship-standard` | 6.95, free from 75 | 4.90, free from 60 | 3.95, free from 50 |
| `mcf-ship-express` | 14.95 | 12.90 | 9.95 |
| `mcf-collect` | 0 | 0 | 0 |

`mcf-collect` is the method that goes with collection lines (`fulfilment-and-availability-model`).

## 4. Custom types and states

- Line item type `mcf-line-fulfilment`: field `fulfilment` enum `collect|ship|subscribe`.
- Channel type `mcf-store`: `addressLine`, `city`, `postalCode`, `phone`, `hours` (text, JSON by weekday), `collectionMinutes` (number).
- Order states (type `OrderState`): `mcf-order-ordered` (initial), `mcf-order-preparing`, `mcf-order-ready-for-collection`, `mcf-order-collected`, with transitions in that order. These keys are in `CONTRACT_KEYS`.
- Review states: `mcf-review-pending` (not included in statistics), `mcf-review-approved` (included), approved is the target of pending.

## 5. Stores (supply channels, role `InventorySupply`)

| Key | City | Country |
| --- | --- | --- |
| `mcf-store-nyc-soho` | New York, SoHo | US |
| `mcf-store-brooklyn` | Brooklyn | US |
| `mcf-store-berlin-mitte` | Berlin, Mitte | DE |
| `mcf-store-munich` | Munich | DE |
| `mcf-store-london-soho` | London, Soho | GB |
| `mcf-store-manchester` | Manchester | GB |

Addresses are invented streets with real city names; coordinates in `geoLocation`. Hours differ per store (some close Sundays).

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

`mcf-cat-pods` (children `-original`, `-vertuo`), `mcf-cat-coffee` (`-beans`, `-ground`, `-single-origin`, `-blends`), `mcf-cat-machines` (`-capsule`, `-bean-to-cup`, `-espresso`, `-filter`, `-grinders`), `mcf-cat-accessories` (`-cups-mugs`, `-frothers`, `-care`, `-storage`), `mcf-cat-gifts`. Slugs per language (en-US, en-GB, de-DE); order hints; images from the image file.

## 8. Products (about 40)

12 pod products (6 Original, 6 Vertuo; variants 10, 50 and 100 capsules), 10 coffees (variants size 250 g and 1 kg crossed with grinds), 8 machines (colour and bundle variants), 8 accessories, 3 gift sets, plus 3 products with no reviews and 2 out of stock at one store so empty states are testable. Names, descriptions and attributes in en-US, en-GB and de-DE. The pods are described as "compatible with Nespresso Original" or "...Vertuo" (D-005).

## 9. Prices

Embedded prices per variant: one each for US/USD, DE/EUR, GB/GBP. USD base table in `seed/src/data/prices.ts`; EUR about 0.92 and GBP about 0.79 of USD rounded to a sensible `.x0` or `.x5` amount; DE and GB are gross. A few variants carry a product discount price. Subscribable pods and coffee also get `recurrencePrices` for each recurrence policy at 10% below the one-time price.

## 10. Recurrence policies

`mcf-every-2-weeks`, `mcf-every-month`, `mcf-every-2-months`, `mcf-every-3-months` (`schedule`: standard, `intervalUnit` Weeks or Months, `value`).

## 11. Inventory

One entry per variant without a channel (online) and one per store channel, quantities deterministic from the SKU and store key so every run is the same; a handful at 0 and a few under the low-stock threshold.

## 12. Discounts

Cart discounts with codes (stackable): `WELCOME10` 10% off, `FREESHIP` free standard shipping, `COFFEE15` 15 off over 60 (currency amounts per market). One automatic product discount for a seasonal sale on selected machines. Keys `mcf-discount-*`; codes are the code strings.

## 13. Customers

Six demo customers, verified, with default shipping and billing addresses in their market, password from `SEED_DEMO_PASSWORD` (at least 10 characters): `maya.okonkwo@example.com` (US), `liam.carter@example.com` (US), `anna.schneider@example.com`, `jonas.weber@example.com` (DE), `emma.clarke@example.com`, `oliver.hughes@example.com` (GB). One customer has a saved-items shopping list `mcf-saved-maya`.

## 14. Reviews

Review states (section 4) and 3 to 12 approved reviews per top product, written by the demo customers in the product's market language, ratings spread 1 to 5 with a realistic skew, keyed `mcf-review-<sku>-<n>`. Verified-purchase links need orders, which the seed does not create (Q-C-04).

## 15. Images

`seed:images` reads `IMAGE_SOURCE_URL` (provided by the owner later, OA-03), takes `pageProps.initialData.data[].attributes.image.download_link` (fallback `large`), strips query and fragment, records width, height and description in `seed/src/data/images.json`. `seed` assigns images to products and categories round-robin by tag match (coffee, capsule, machine, cup) and adds them to existing products on re-run.

## 16. Verification

`npm run verify` reads settings, per-type counts, one sample of each type, review statistics against seeded reviews, prices against the table, inventory against the rule, and exits non-zero on any mismatch. The unit tests run the same checks against the in-memory fake API.

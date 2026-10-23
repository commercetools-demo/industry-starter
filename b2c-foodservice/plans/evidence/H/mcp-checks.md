<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# H-00 preconditions: what was checked, and what needs a live project

No commercetools credentials exist for this workstream (JUNIOR-GUIDE rule 4), and the `commerce-mcp` server does not connect in this
session. Everything below was checked statically against the seed package, the installed SDK type declarations and the mock server's
fixtures (generated from the seed). The live part is the owner row `OA-H-a` in `plans/notes/todo-H.md`.

## Checked statically (done)

| Precondition | Result | Where |
| --- | --- | --- |
| Product types and attribute names of SEED-PLAN section 6 | `mcf-pods` (system, intensity, roast, flavourNotes, origin, decaf, organic, fairtrade, capsulesPerPack, badge, subscribable), `mcf-coffee` (roast, origin, process, flavourNotes, intensity, decaf, organic, fairtrade, brewMethods, sizeGrams, grind, badge, subscribable), `mcf-machine` (system, pressureBar, waterTankMl, powerWatts, features, warrantyMonths, colour, bundle, badge, subscribable), `mcf-accessory` (kind, material, capacityMl, colour, badge, subscribable), `mcf-gift-set` (contents, occasion, badge, subscribable) | `seed/src/data/product-types.ts`, `storefront/scripts/mock-fixtures/seed-fixtures.json` |
| A pod, a coffee, a machine and an accessory with several variants | Pods: 3 pack sizes (10, 50, 100); coffee: size (250 g, 1 kg) by grind; machine: colour by bundle (machine-only, starter-capsules); accessory: colour (e.g. glass cups cream, black); gift set: one variant | fixtures (12 pods, 10 coffees, 8 machines, 8 accessories, 3 gift sets) |
| Inventory per variant online and per store | Online 40 to 499 per SKU; six store channels, 1 in 20 at 0, 1 in 7 low; `POD-EMBER` and `MAC-POD1` are 0 at `mcf-store-brooklyn-williamsburg` and in stock online | `seed/src/data/extras.ts` (`quantityFor`), `products.ts` (`OUT_OF_STOCK_AT_STORE`) |
| `recurrencePrices` on a subscribable variant | Every subscribable product gets one embedded price per recurrence policy and market, 10% below the one-time price (`RECURRENCE_DISCOUNT`) | `seed/src/data/prices.ts` |
| Recurrence policies | Four standard policies: every 2 weeks, every month, every 2 months, every 3 months | `seed/src/data/extras.ts` |
| SDK exposes `recurrencePolicies()` | Yes: `ByProjectKeyRequestBuilder.recurrencePolicies()` with `get`, `withKey`, `withId` (platform-sdk 8.27) | `node_modules/@commercetools/platform-sdk/.../by-project-key-request-builder.d.ts` |
| `ProductVariant.recurrencePrices` | Typed as `Price[]` with `recurrencePolicy` reference | `models/product.d.ts`, `models/common.d.ts` |
| `addLineItem` takes `supplyChannel` and `recurrenceInfo` | `CartAddLineItemAction` has both (`ChannelResourceIdentifier`, `LineItemRecurrenceInfoDraft` with `recurrencePolicy` and `priceSelectionMode: 'Dynamic' | 'Fixed'`). No cast is needed, so `buildAddLineAction` is fully typed | `models/cart.d.ts` |
| Line item custom type key `mcf-line-fulfilment`, field `fulfilment` with values collect, delivery, subscribe | Defined by the seed | `seed/src/data/custom-types.ts`, `base.ts` (`K.typeLine`) |
| `InventoryEntry` fields | `restockableInDays`, `expectedDelivery`, `minCartQuantity`, `maxCartQuantity` exist | `models/inventory.d.ts` |

## Needs a live project (owner row OA-H-a)

Run once the seed has been applied to `spec-test-b2c-food` (OA-01, then the seed) and record the outcome here:

1. Product Search `exact` on `variants.sku` returns the product for one seeded SKU (`limit: 1`).
2. `GET /product-projections/{id}` with `priceCurrency`, `priceCountry` returns `recurrencePrices` on a subscribable variant (and none appear when `recurrencePrices` is added to `expand`: the skill says never add it).
3. `POST /carts/{id}` `addLineItem` with `supplyChannel` plus `custom.fields.fulfilment = collect` creates a separate line from the delivery line of the same SKU.
4. `addLineItem` with `recurrenceInfo { recurrencePolicy, priceSelectionMode: 'Fixed' }` is accepted and the line price equals the recurring price.
5. `GET /recurrence-policies` lists the four seeded policies.

Any difference goes to `plans/PROJECT-FINDINGS.md`. The behaviour if the platform refuses a combination is already covered in the cart code: the platform
errors map to `price_unavailable` (422) or `not_found` (404) and never leak commercetools text.

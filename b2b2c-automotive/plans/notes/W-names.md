<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream W: names as built (J17, 2026-10-12)

The plan's intended names against the real files. Where a file differed from the plan, the file won.

| Plan | Built | Note |
| --- | --- | --- |
| `getRetailPrice(storeKey, sku)`, `setStandalonePrice(storeKey, sku, channelKey, cents)` | `lib/ct/seller/prices.ts` (T), used as is | `undefined` channel = the store's retail (distribution) channel; key `<sku>__<channelKey>` via `standalonePriceKey` |
| `isAssigned`, `assign` | `isAssigned` in `lib/ct/seller/assortment.ts`, `assignProducts` in `assortment-write.ts` | `assignProducts` needs a PUBLISHED product (T reads published projections), see Q-W16 |
| `allocateSortOrder`, `createDiscountDraft` | `allocateSortOrder(kind, held, 'malva-funded')` in `lib/catalog/sort-order.ts`; W builds its own cart discount draft in `lib/ct/seller/campaigns.ts` | `createDiscountDraft` (T) makes an empty reseller draft, not a Malva-funded one |
| `lib/ct/seller/discounts.ts` sort order helper | not exported by T (`heldSortOrders` is private); W reads all cart discount sort orders itself | |
| `onAssortmentChanged` | `lib/ct/seller/assortment-write.ts`; W registers `reconcileBundles` in `lib/ct/seller/bundles-hook.ts`, loaded by one dynamic import at the end of `assortment-write.ts` | T's tests clear the array in `beforeEach`, so they are unaffected |
| `lib/portal/route-policy.ts` / `lib/authz/route-policy.ts` | does not exist | Q-W17; role matrix test instead |
| `lib/theme/brand.ts` copy of the storefront adapter and `check-shared-copies.mjs` | `lib/theme/brand.ts` reads `getStoreTheme` and `themePrimaryColour` of `lib/contentools/theme.ts` (U-06 built exactly for W) and the logo from `getStoreSettings` | no copy of the storefront adapter was needed; there is no `check-shared-copies.mjs` in the portal |
| `lib/ct/admin-client.ts` | `wRoot()` in `lib/ct/seller/w-root.ts` (admin client, or the W fixture client with `PORTAL_DEV_FIXTURES=on`) | |
| seed custom object `malva-local-review` | read and written under container `malva-local-review`, key `<storeKey>--<productKey>`, value `{ state, storeKey, productKey, sku, claimedVehicles }` | the seeded `SK-2002` has no record: its flag reads "Awaiting Malva review" |
| Import API product draft | `lib/import/import-api.ts` `productDraftResource`: `masterVariant.key` (= SKU) is required by the Import API (confirmed in the OAS `ProductVariantDraftImport`), `priceMode: 'Standalone'`; standalone price import path is `/standalone-prices/import-containers/<key>` and its key is `standalonePriceKey(sku, channelKey, 'EUR')` (T's scheme), not `price-<store>-<sku>` | so T's price writer later finds and updates the imported price |
| No storefront code reads `malva-email-templates` | confirmed: nothing in `storefront/` or `portal/` reads the container except W's own admin routes | W-06 |
| HTTP 422 | 409 and 400 | Q-W13 |

Containers W uses: `malva-coop-campaigns` (read only, Malva-owned), `malva-coop-claims` (`<campaignKey>--<storeKey>`), `malva-email-templates` (`<storeKey>--<templateKey>`), `malva-email-campaigns` (`<storeKey>--<id>`), `malva-local-review`, plus reads of `mau-vehicles` and `mau-assortment` (writes only the `pendingReview` list, like the seed). No custom type and no product type is created.

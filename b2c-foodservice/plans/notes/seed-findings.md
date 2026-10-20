<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Seed findings (what was checked, what is surprising)

Written while building `seed/`. Everything below was checked against the commercetools Knowledge MCP (OpenAPI specs and documentation search) and against the type declarations of `@commercetools/platform-sdk` 8.x installed in `seed/node_modules`. Nothing was run against a live project (no credentials), so every item marked UNVERIFIED LIVE is a first-live-run check. The `commerce-mcp` server failed to connect in this session (CONNECTION_CLOSED); only the knowledge server was used.

## Verified in documentation or SDK types

- **Review states:** a review counts in `reviewRatingStatistics` when its state has the role `ReviewIncludedInStatistics` (State `roles`, type `ReviewState`). `mcf-review-approved` has it, `mcf-review-pending` has none. `StateDraft.transitions` takes resource identifiers (keys are fine), so the target state must exist first: approved before pending, collected before ready, ready before preparing, preparing before ordered.
- **ReviewDraft** (SDK 8): `key`, `uniquenessValue`, `locale`, `authorName`, `title`, `text`, `target` (product or channel), `state`, `rating`, `customer`. `uniquenessValue` is what enforces one review per customer and product; the seed sets it to the review key.
- **Project actions:** `changeProductSearchIndexingEnabled` { enabled, mode: `ProductsSearch` } and `changeCountryTaxRateFallbackEnabled` { countryTaxRateFallbackEnabled }; the read side is `searchIndexing.productsSearch.status` and `carts.countryTaxRateFallbackEnabled`. `changeLanguages`, `changeCountries`, `changeCurrencies` replace the whole list, so the seed sends the union (add only).
- **Tax rates:** `TaxRateDraft` has `state` (used for New York) and `includedInPrice`; the country rate without a state is the fallback.
- **Shipping:** `ShippingRateDraft` { price, freeAbove, tiers }; the free-above tier is `freeAbove`. Updates use `addZone`, `addShippingRate`, `removeShippingRate`.
- **Channels:** `ChannelDraft` accepts `roles`, `address`, `geoLocation` (GeoJSON Point, `[lng, lat]`) and `custom`; update with `setCustomField`.
- **Recurrence policy:** `{ key, name, schedule: { type: 'standard', value, intervalUnit: 'Days' | 'Weeks' | 'Months' } }`; a policy cannot be deleted while a line item, cart or cart discount references it.
- **ShoppingListDraft:** `name` (required), `slug`, `customer`, `key`, `lineItems[]` with `sku`.
- **InventoryEntryDraft:** `sku`, `key`, `supplyChannel`, `quantityOnStock`; no `supplyChannel` means the online entry.
- **Variants:** the Variant API (`/variants`) exists next to products; the seed uses the product endpoints (`setPrices`, `addExternalImage`, `removeImage`, `setAttribute`, all with `sku` and `staged`).

## Surprising or open (UNVERIFIED LIVE)

1. **Embedded recurrence prices.** The SDK 8 `PriceDraft` has no `recurrencePolicy` field; `StandalonePriceDraft` and the read-side `Price` do. The documentation (commerce-patterns skill, "Embedded price with recurrence policy") shows `addPrice` with `price.recurrencePolicy`, and the read side exposes `ProductVariant.recurrencePrices[]` (only "available when product price selection is used" per the SDK comment). The seed sends embedded recurrence prices as `prices[]` entries carrying `recurrencePolicy: { typeId, key }` and treats entries from `prices` and `recurrencePrices` alike when comparing. See Q-S-2.
2. **Attribute constraints are irreversible** (`SameForAll`, `CombinationUnique`). See Q-S-3.
3. **Product discount predicate** is written as `sku in ("...","...")`; the key-based `categories` predicates of the automotive project were not reused. Check the discount is active on the three machines after the first run.
4. **Cart discount predicates** for `COFFEE15` use three `lineItemTotal(true) >= "<amount> <currency>"` clauses joined by `or`; the free-shipping discount has predicate `true`.
5. **Customers:** the draft sets `isEmailVerified: true` and the default shipping and billing address indexes; the script additionally verifies unverified existing accounts through the email token endpoints.
6. **Review `customer`** may be left out for reviews 7 to 12 (synthetic authors); the API allows reviews without a customer.
7. **Deleting a customer** also needs nothing special in the API, but the cleanup deletes with a fresh version fetched by id, never with the manifest's version.
8. **`SEED_CTP_*` names only.** The unprefixed fallback names of the automotive package were not carried over.
9. **Type-system vs fake:** the fake API emulates statistics (`reviewRatingStatistics`: count, average, highest, lowest, distribution), the `uniquenessValue` duplicate rejection and referential integrity on delete; real behaviour of the platform on those points is documented but not run.

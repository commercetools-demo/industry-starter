<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Workstream L: Product Search syntax checks

No credentials exist in this environment, so the section 7.1 checks against the live project are manual rows (`plans/TODO-MANUAL-TESTING.md`, M-L-2 to M-L-6). This file records what the commercetools documentation (Knowledge MCP, 2026-10-12) and the SDK types confirmed, and what stays unverified.

## Confirmed from the documentation and the SDK types

| Item | Result |
| --- | --- |
| Category subtree | `exact` on the keyword field `categoriesSubTree` with `value` (one category id) or `values` (several, OR). Docs "Product Search > Filter by Category subtree". Not available on Product Projection Search. |
| Review rating sort | `reviewRatingStatistics.averageRating` (also `highestRating`, `lowestRating`, `count`) is a sortable field: `{ field, order: 'desc' }`. Docs "Sort by review ratings". |
| Popular sort and `missing` | The SDK type `SearchSorting` has no `missing` key. Docs "Sort mode": a product without the sort field is placed last. So `popularity-rank` ascending needs no `missing: 'last'`; the key was dropped from the plan (Q-L04). Attribute sort needs `fieldType: 'number'`. |
| Sort `filter` | `SearchSorting.filter` takes a compound expression; the docs example scopes a price sort by `variants.prices.channel` and `variants.prices.currencyCode`. Products that do not match the filter come last in an undetermined order (our second sort key is the name). |
| `not` | The SDK type is `not: SearchQuery[]` (an array), not an object. The plan's `{ not: { exists } }` became `{ not: [ { exists: ... } ] }`. |
| `exact` with `values` | Up to 100 values per expression, 500 per request; fine for brand lists and for two price channels. |
| Stock filter | `variants.availability.isOnStockForChannel` (exact, value = channel id). Stock data is filterable but not retrievable from Product Search; the card reads `availability.channels` of the projection. |
| Facets | `distinct` facets run in the scope of the query by default (`scope: 'all'` would count the whole index); `postFilter` is applied after facet counting, so brand counts stay. `fieldType` is required for attributes; enum attributes use `.key`. |
| Full text | `fullText` on `name` with `language`; `caseInsensitive` accepted. Terms match as whole words (a prefix such as `bremsb` finds nothing; see MISSED-FEATURES). |
| Price fields | `variants.prices.currencyCode`, `.country`, `.channel`, `.centAmount` are searchable for standalone prices. Prices are not retrievable from Product Search (D2). |
| Tailoring | Product Search does not return or search tailored data. The cards use the project query endpoint with `storeProjection=<store key>` (the SDK has no list call below `in-store/key=`), which applies the store's selections and tailoring. |
| Scopes | `view_products` (Product Search, product types, inventory) and `view_standalone_prices` (standalone prices) added to `lib/scopes.ts` and `.env.example`. |

## Not confirmable offline (live rows)

| Item | Why it needs the project | Row |
| --- | --- | --- |
| `{ not: [ { exists: { field: 'variants.prices.channel' } } ] }` inside a sort filter | The docs show `exact` filters in sort filters; `not` and `exists` there are accepted by the grammar but not demonstrated | M-L-2 |
| `exact` with `values` on `variants.prices.channel` in a sort filter | Same; fallback is one `exact` per channel inside the `or` | M-L-2 |
| `categoriesSubTree` as a facet (used by the nav of workstream I) | Docs show it as a filter only | M-L-2 |
| `storeProjection` returns only the store's assortment and tailored text and images | Needs real selections and tailoring | M-L-3 |
| `discounted` on the standalone price when a Product Discount applies | Needs the seeded discounts | M-L-3 |
| Counts, sort order (two or three prices in scope) and part number search against the seed | Needs the seed | M-L-4 to M-L-6 |

## Offline check that ran instead

The Chrome run (`storefront-*.png`) used a throw-away local fake of the endpoints in the seeded shape (30 parts, categories with ancestors, standalone prices on base, retail and branch channels, per-branch stock, reviews, popularity ranks). The fake evaluates the exact request bodies the app sends (`and`, `or`, `not`, `filter`, `exact`, `fullText`, `exists`, `postFilter`, facets, sort with filter), so the request shapes are exercised end to end; it proves our requests are self-consistent, not that commercetools accepts them.

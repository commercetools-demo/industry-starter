<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# G-00 platform checks (commercetools MCP, read only)

The `food-service` MCP is connected to the project and Product Search is active (`read_product_search` answers), but the **seed has not been run**: the project still holds 117 products that are not ours (no `mcf-` keys), no `badge` or `subscribable` attributes, no `mcf-line-fulfilment` type. So the seed-dependent gates cannot be confirmed live yet; they are rows `OA-G-a` and `M-G-03` in `plans/notes/todo-G.md`. Everything else was checked against the real API. No ids of foreign data are kept here.

| Gate (G-browse 3.3) | Request (trimmed) | Result | Verdict |
| --- | --- | --- | --- |
| Product Search active | `read_product_search { limit: 1 }` | `total: 117`, one id returned | Search is `Activated` and indexed. Seeded count (about 41 products) not visible yet: seed not run |
| (b) facet `filter` accepted on `distinct` and `ranges` | `facets: [ distinct { name: cat, field: categories, fieldType: text, level: products, limit: 3, filter: exact variants.prices.currencyCode = USD }, ranges { name: r, field: reviewRatingStatistics.averageRating, ranges: [ { key: 4.5, from: 4.5 } ], filter: exact ... } ]` | Both facets returned (`cat` with buckets array, `r` with bucket `4.5`, count 0) and no error | PASS: per-facet `filter` works, so the faceted-count rule (3.4) is built on it and the one-request-per-group fallback is not needed |
| (d) `boost` on `exact` and on `fullText` in an `or` | `query: or [ exact variants.sku boost 10 caseInsensitive, fullText name language en-US boost 3 ]` | accepted, total 0 for the probe value | PASS (syntax accepted; ranking effect is verified against the seed in M-G-03) |
| rating statistics field | `ranges` on `reviewRatingStatistics.averageRating` | accepted | PASS (Q-G-01: no seed fallback needed) |
| (a) product-level `badge` / `subscribable` searchable at `variants.attributes.*` | needs the seed product types | not testable yet | OPEN: `OA-G-a`. The app assumes it; if it fails, add `badge` and `subscribable` as variant-level `SameForAll` attributes (seed request) |
| (c) currency, country and centAmount in one `and` match the same price object | needs seeded prices | not testable yet | OPEN: `OA-G-a`. The request builder puts them in one `and` as the docs describe |
| (e) `set_enum` facet on `brewMethods` | needs the seed | not testable yet | OPEN: `OA-G-a` |
| `limit: 0` for counts | not run (the MCP tool minimum is 1) | untested | OPEN: if the API rejects 0, change `limit` in `lib/ct/search.ts` countOnly to 1 (one line) |

Price sort scope (docs: sorting ignores the query and filters): not observable without the seed; the listing accepts it. With the mock catalogue the engine mimics the same rule (price sort uses the cheapest variant in the market).

## What the browser recipe was run against

No live seed means the recipe ran against `scripts/mock-ct-server.mjs`, extended in G to serve the seed's own data (41 products, 20 categories, 6 stores, prices, per-store stock, review statistics) and a small Product Search engine that is pinned to `lib/search/build.ts` by `scripts/mock-fixtures/mock-catalog.test.ts`. Counts below are therefore counts against the seed data, computed independently by the mock engine and by direct arithmetic over `seed/src/data` in that test.

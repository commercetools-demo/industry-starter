<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Search results with exact part-number resolution

## Purpose

Procurement-style buyers arrive with an identifier, not a description: they paste a part number from a datasheet or a previous invoice and expect one answer. Relevance ranking over product names does not reliably put an exact identifier match first, and a buyer who has to scan a ranked list for the code they already typed will use the phone instead. The same search box still has to serve descriptive queries, so identifier matching is an additional path, not a replacement.

## Plan notes

**As built by workstream P (D-056).** "Misspelt query" uses fuzzy matching on Product Search (no "Did you mean" correction); type-ahead suggestions are not built (Product Projection Search is unavailable). "Part number pasted" flags an exact SKU. Detail-page links are replaced by `offerHref`. German catalog names are English, so German queries find nothing (Q-019).

## Requirements

### Requirement: Search results with exact part-number resolution

The system SHALL resolve a query that exactly matches a variant SKU or part number to that variant as the first result, rather than ranking it only as free text among other matches.

#### Scenario: Part number pasted
- **GIVEN** a buyer pastes a string that exactly matches one variant's SKU
- **WHEN** the search runs
- **THEN** that variant's product is the first result and the variant that matched is identified on the card

#### Scenario: Query matches nothing
- **GIVEN** a query that matches no product
- **WHEN** the results page renders
- **THEN** the absence of matches is stated, the query stays editable, and the configured fallback content is offered instead of an empty grid

#### Scenario: Misspelt query
- **GIVEN** a query of more than five characters containing a typo
- **WHEN** the search runs
- **THEN** typo-tolerant matching returns the intended products, and no correction is claimed that the search cannot actually make

#### Scenario: Unsupported language
- **GIVEN** a query issued in a language the project is not configured for
- **WHEN** the search runs
- **THEN** the page reports that the language is not supported rather than presenting a legitimate empty result

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Search bar with active query | `[STATIC]` | UI shell |
| Results count and query label | `[CACHED]` | Total hits from search index |
| Faceted filters | `[CACHED]` | Same as the product listing page |
| Product cards — catalog data | `[CACHED]` | From search index |
| Product cards — price | `[MIDDLEWARE]` | Contract pricing overlay on search results |
| Product cards — availability | `[MIDDLEWARE]` | Real-time inventory |
| Sort controls | `[STATIC]` | UI config |
| Spelling suggestion prompt | `[CACHED]` | Search engine suggestion |
| No-results state with suggestions | `[CACHED]` | Merchandising fallback rules |

## commercetools

**Entities:** `Product`, `ProductProjection`, `ProductType`, `Store`, `StandalonePrice`, `InventoryEntry`

**Verified API surface**

- (rest) variants.sku is a keyword field in Product Search, usable in exact, prefix, wildcard and exists expressions, so a part-number lookup is an exact expression rather than a full-text query — [docs](https://docs.commercetools.com/api/projects/product-search)
- (rest) Setting markMatchingVariants to true makes the response carry matchingVariants with the id and sku of the variants that matched, which is how a card can show the buyer which variant answered their query — [docs](https://docs.commercetools.com/api/projects/product-search)

**Constraints that change the design**

- Search Term Suggestions is prefix autocomplete over a Product's SearchKeywords - it is not spell correction, it returns nothing for numeric values or special characters such as inch marks, and it fails with SearchDeactivated unless Product Projection Search is activated for the Project — [docs](https://docs.commercetools.com/api/projects/search-term-suggestions)
- Typo tolerance comes from a fuzzy expression on Product Search, whose fuzziness adjusts automatically to term length; Product Projection Search has fuzzy parameters but no automatic level and no per-field control — [docs](https://docs.commercetools.com/api/storefront-search-overview)
- Product Search only supports Locales configured on the Project - a query for an unconfigured Locale returns no results at all, which is indistinguishable from a genuine zero-match unless the storefront checks the Project's Locales — [docs](https://docs.commercetools.com/api/projects/product-search)

**Modeling notes**

Run the identifier path and the free-text path as one compound query rather than two round trips, and let the exact expression on variants.sku carry its own boost. The no-results state and the spelling prompt are different problems: the fallback content is a merchandising decision the storefront owns, while genuine "did you mean" correction is not something the platform provides.

## commercetools skills

Load `commercetools-platform` before implementing this capability. Supporting: `commercetools-storefront`, `commercetools-commerce-patterns`. Any task generated from this spec carries `[SKILL: commercetools-platform]`.

## Open questions

- What is shown when a pasted identifier matches variants of more than one product? The requirement resolves to a single variant, which presumes the identifier is unique, and a shared or re-used part number breaks that presumption.
- Is a real 'did you mean' correction in scope? It needs an external search engine; commercetools offers fuzzy matching and keyword autocomplete, not correction.
- Who curates the no-results fallback content, and is it per category or global?

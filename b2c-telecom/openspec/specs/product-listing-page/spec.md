<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Category listing with request-derived filter and page state

## Purpose

A listing is only useful if a buyer can narrow it, share it and come back to it. State held in the client instead of the request breaks the back button, breaks a pasted link and makes the page impossible to cache, which matters most here because catalog cards are the largest shared payload in the storefront. Keeping the state in the request is also what lets the shared card data be cached while price and availability stay per-buyer.

## Plan notes

**As built by workstream N (D-019).** The availability indicator and availability facet are not built (services have no inventory); there is no price facet. The sort select is undrawn UI (D-064, D-068).

## Requirements

### Requirement: Category listing with request-derived filter and page state

The system SHALL derive a category listing's result set, active facets, sort order and page position entirely from the request, so that the same request reproduces the same listing state for the same buyer.

#### Scenario: Filters survive a reload
- **GIVEN** a listing narrowed by two facets and sorted by a non-default order
- **WHEN** the buyer reloads the page or opens the same link in a new session
- **THEN** the same facets, sort order and page are active, and the result count matches

#### Scenario: Facet combination with no matches
- **GIVEN** a combination of facets that matches no product
- **WHEN** the listing renders
- **THEN** the empty result is stated with the active facets still visible and individually removable

#### Scenario: No price for this buyer
- **GIVEN** a product in the listing with no price matching the buyer's currency and context
- **WHEN** the card renders
- **THEN** the card states that no price is available to the buyer rather than showing zero or a price in another currency

#### Scenario: Page past the last result
- **GIVEN** a page position beyond the total number of results
- **WHEN** the listing is requested
- **THEN** the last page that has results is returned, not a blank grid

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Breadcrumb navigation | `[CACHED]` | Derived from category tree |
| Category title and description | `[CACHED]` | CMS or category metadata |
| Faceted filters (brand, attributes, availability) | `[CACHED]` | Facet config is cached; applied counts may be MIDDLEWARE if inventory is real-time |
| Sort controls | `[STATIC]` | UI config only |
| Product cards — image, name, SKU | `[CACHED]` | Catalog data, shared across users |
| Product cards — price | `[MIDDLEWARE]` | Contract / customer-group pricing; user-specific |
| Product cards — availability indicator | `[MIDDLEWARE]` | Real-time inventory per warehouse / delivery location |
| Active filter tags and clear filters | `[STATIC]` | UI state, client-side |
| Pagination or infinite scroll | `[CACHED]` | Page of products from catalog |
| Results count indicator | `[CACHED]` | Total results for the query |

## Design

Reference: `design/specs/plp.md`; tokens per `design-system-tokens`.

One template serves phone, wireless and cable: honey-tinted title strip (breadcrumb, H1, blurb) → filter chips with a "{n} plans" count → `auto-fill minmax(300px,1fr)` grid of plan cards (honey header with tag/name/price, ▸ bullets, validity line, outlined pill CTA "Choose plan" ⇄ "Selected ✓") → add-ons upsell band.

Design-to-spec mapping and deviations:

- Filters in the design are a single row of mutually exclusive chips (phone: All / Unlimited / Data-capped; wireless: All / 5G / LTE; cable: All / Up to 500 Mbps / 1 Gbps). Chip state belongs in the URL (see the request-derived filter requirement), not component state.
- There is **no sort control, faceted sidebar or pagination** in the design; catalogs are 3–4 plans per category.
- Selecting a plan in the design replaces any other plan in the same category and does not add to the cart until checkout; the existing cart behavior (`cart-page`, `mutually-exclusive-offers`) governs. Decide whether "Choose plan" adds a cart line immediately (recommended: yes, keeping the header count truthful).
- "Most popular" is part of the tag text in the prototype; model it as an attribute or merchandising flag.

## commercetools

**Entities:** `Product`, `ProductProjection`, `Category`, `Store`, `ProductSelection`, `StandalonePrice`, `InventoryEntry`

**Verified API surface**

- (rest) Product Search takes a search-query-language body and returns total, offset, limit, count and results; the next page is the same query with offset advanced by limit, which makes page position a pure function of the request — [docs](https://docs.commercetools.com/api/projects/product-search)
- (rest) Setting limit to 0 on a Product Search request returns facet aggregations with no product results, which builds the filter UI without paying for product data — [docs](https://docs.commercetools.com/api/projects/product-search)

**Constraints that change the design**

- Product Search returns only matching Product IDs by default - full representations come from the GraphQL productsSearch query or a follow-up Product Projection read, while price selection and scoped-price filtering, faceting and sorting are Product Projection Search features rather than Product Search ones — [docs](https://docs.commercetools.com/api/storefront-search-overview)
- Availability in search is doubly eventually consistent: InventoryEntry syncs asynchronously to ProductVariantAvailability, which syncs asynchronously to the search index, so an availability facet count can disagree with real stock — [docs](https://docs.commercetools.com/learning-model-your-product-catalog/inventory-modeling/inventory-management)
- Scoped Price search - filtering, faceting and sorting on the scoped price - works only with Embedded Prices; on Products with Standalone price mode the results are inconsistent because only Embedded Prices are considered — [docs](https://docs.commercetools.com/api/pricing-and-discounts-overview)

**Modeling notes**

Cache the card payload on a key of category, facets, sort, page and locale, and overlay price and availability per request. That split is what makes the CACHED and MIDDLEWARE mix on this page work: the catalog half is identical for every buyer, the commercial half never is. Decide early whether price is a facet or a filter, because a price facet forces Embedded Prices.

## commercetools skills

Load `commercetools-storefront` before implementing this capability. Supporting: `commercetools-platform`, `commercetools-commerce-patterns`. Any task generated from this spec carries `[SKILL: commercetools-storefront]`.

## Open questions

- Are prices modeled as Embedded or Standalone, given that a price facet or price sort constrains the choice?
- Should availability be an offered facet at all, given the indexing lag on availability data?

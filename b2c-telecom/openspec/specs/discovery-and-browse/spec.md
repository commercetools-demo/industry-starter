<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Discovery and browse

## Purpose

A buyer who arrives without a specific product in mind is the largest share of storefront traffic. If the only path to a product is knowing its SKU, every discovery-led visit is lost, and in B2B the catalog a buyer may see is narrower than the full catalog, so discovery has to be scoped as well as fast.

## Plan notes

**As built by workstreams N and O (D-052).** Detail links are replaced by `offerHref` (no product detail page). Category and header data come from the live category tree.

## Requirements

### Requirement: Discovery and browse

The storefront SHALL let a buyer reach a relevant product from the homepage, a category or search without knowing a product identifier in advance.

#### Scenario: Browse a category
- **GIVEN** a buyer on the homepage with no product in mind
- **WHEN** the buyer follows a featured category
- **THEN** a paginated, filterable list of products in that category is shown with prices resolved for that buyer

#### Scenario: Nothing matches
- **GIVEN** a search or filter combination with no matching products
- **WHEN** the results render
- **THEN** the empty state is explicit and offers a way back into the catalog rather than a blank list

## Pages

- [Landing page with session-resolved buyer context](../home-landing-page/spec.md)
- [Product detail page showing the buyer's effective price](../product-detail-page/spec.md)
- [Category listing with request-derived filter and page state](../product-listing-page/spec.md)
- [Search results with exact part-number resolution](../search-results-page/spec.md)
- [About page assembled entirely from published CMS content](../about-us/spec.md)
- [Articles addressable and indexable independently of the listing](../blog-resources/spec.md)
- [Error pages that name the failure and route the buyer back](../error-pages/spec.md)

## commercetools

**Entities:** `Product`, `ProductSelection`, `Store`, `Channel`, `Category`

**Verified API surface**

- (concept) Product Search (the GraphQL productsSearch query) is the discovery surface; it can scope results to a buyer's commercial context, which is what makes an entitlement-narrowed catalog possible — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/discover-and-order-products-in-b2b/product-search-for-b2b-catalogs)
- (concept) A Store plus Product Selection defines which products a given buyer may see; price scope is resolved separately through the distribution Channel — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/design-b2b-catalogs/overview)

**Modeling notes**

Catalog data is shareable and cacheable; the price and availability overlay is not. Design the discovery surfaces so the cacheable half renders first and the per-buyer half arrives as an overlay, or every listing page becomes a per-request middleware call.

## commercetools skills

Load `commercetools-storefront` before implementing this capability. Any task generated from this spec carries `[SKILL: commercetools-storefront]`.

## Open questions

- Is the catalog identical for every buyer, or entitlement-scoped per company?

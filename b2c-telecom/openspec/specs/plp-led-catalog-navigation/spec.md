<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Category listings as the only catalog surface, reached from header and home

## Purpose

Malva Telecom does not sell products one at a time to people who already know them. A visitor comes to get home internet or a phone plan, compares a handful of tiers side by side, picks one and decides on extras. A separate detail page per offer adds a click and hides the comparison the visitor came for. So the catalog has no product detail page: every offer is shown, configured and added to the cart from a listing for its category, and the listings are reached from the header navigation and from banners and tiles on the home page. This changes the existing detail-page assumptions and must be stated explicitly so the two do not coexist half-built.

This capability supersedes the `product-detail-page` spec and the detail-page links in `discovery-and-browse` and `search-results-page` for this project.

## Plan notes

**As built by workstream N (D-052).** Category route `/<locale>/shop/<slug>` with the `?offer=<key>` anchor; other-locale slugs redirect 307; an unknown slug and `/product/<x>` answer 404. "Mobile navigation" is the slide-in drawer built in I (D-051). The default sort is cheapest first (no order hint, Q-016); only `price-asc` and `price-desc` exist. The header shows root categories only; child categories are linked from a "Browse by type" strip.

## Requirements

### Requirement: Category listings as the only catalog surface

The system SHALL present every sellable offer on a category listing, where the buyer can see its key specifications and price, configure it and add it to the cart, and SHALL NOT expose a per-product detail route.

#### Scenario: Offer configured and added from the listing
- **GIVEN** a listing of phone plans
- **WHEN** the buyer picks a contract term on a plan card and adds it to the cart
- **THEN** the plan is added with that term and the cart reflects it, with no navigation away from the listing

#### Scenario: No detail route exists
- **GIVEN** a request to a path shaped like a product detail page
- **WHEN** the route is resolved
- **THEN** the standard not-found page is returned and no product page is rendered

#### Scenario: Linking to one offer
- **GIVEN** a search result, a banner or an email that refers to a specific offer
- **WHEN** the buyer follows it
- **THEN** the offer's category listing opens scrolled to and visually marked on that offer's card, and the link is stable across locales

#### Scenario: Offer in more than one category
- **GIVEN** an offer assigned to two categories
- **WHEN** a link to it is generated
- **THEN** it targets the offer's primary category, so that one offer has one canonical listing URL

#### Scenario: Empty category
- **GIVEN** a category with no sellable offers for the buyer's market
- **WHEN** the listing renders
- **THEN** an explicit empty state with links to the other categories is shown, not a blank page

### Requirement: Header navigation and home entry points derived from the category tree

The system SHALL build the header navigation and the home page's category banners and tiles from the commercetools category tree, so that categories are added, reordered or hidden by changing catalog data rather than code.

#### Scenario: Header reflects the tree
- **GIVEN** top-level categories for cable internet, home wireless, phone plans and add-ons
- **WHEN** the header renders
- **THEN** it shows them in category order, with child categories as submenu entries, in the buyer's locale

#### Scenario: New category appears without a deploy
- **GIVEN** a category published in commercetools after the last deploy
- **WHEN** the cache window has elapsed
- **THEN** it appears in the header and can be targeted by a banner

#### Scenario: Banner target does not resolve
- **GIVEN** a home banner whose configured category slug no longer exists
- **WHEN** the home page renders
- **THEN** the banner is omitted rather than rendered as a broken link, and the omission is logged

#### Scenario: Add-ons reached from the offer being configured
- **GIVEN** the buyer is on a plan card
- **WHEN** the card lists add-ons for that plan
- **THEN** each add-on can be selected in place, and the same add-ons remain separately browsable under the add-ons category

#### Scenario: Mobile navigation
- **GIVEN** a narrow viewport
- **WHEN** the buyer opens the menu
- **THEN** the same category tree is available, with the same ordering and locale, in a collapsed form

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Header navigation | `[CACHED]` | Category tree with TTL; ordered by category order hint |
| Home banners and category tiles | `[CACHED]` | Target a category by slug; image from category assets |
| Category listing route `/[locale]/shop/[slug]` | `[CACHED]` | The `shop/` prefix avoids collisions with cart, checkout, account and search routes |
| Offer card — specs, term selector | `[CACHED]` | Variant attributes from the catalog |
| Offer card — price | `[MIDDLEWARE]` | Resolved for the buyer's currency and country |
| Offer card — add-on and equipment pickers | `[CACHED]` plus `[MIDDLEWARE]` | Definitions are shared; compatibility against the current cart is per request |
| Offer anchor and highlight | `[STATIC]` | Fragment keyed by the offer's key |
| Breadcrumb | `[CACHED]` | Derived by walking the in-memory tree |
| Empty and not-found states | `[STATIC]` | Link back into the catalog |

## commercetools

**Entities:** `Category`, `Product`, `ProductProjection`, `ProductType`, `Store`, `ProductSelection`

**Verified API surface**

- (rest) Categories carry localized slugs, an order hint and a parent, which is what makes a navigable tree and a stable URL possible; the tree is read in one call and walked in memory rather than queried per level — see the commercetools-storefront skill's product-listing reference
- (concept) Product Selections control which products a Store may sell, while Categories configure the navigation and browsing experience — [docs](https://docs.commercetools.com/api/product-catalog-overview)

**Constraints that change the design**

- Removing the detail page removes the place where a variant, price and availability were resolved together. That resolution moves onto the card, so the listing query must return every variant a card's selectors need in one request, or card selection becomes an N+1.
- A product has one primary category for URL purposes even when it is assigned to several; the choice must be data (the first assigned category, or an explicit attribute), not a runtime guess.
- Search results currently link to detail pages in the existing spec; they must target the listing anchor instead.

**Modeling notes**

Each plan tier is one Product (one card) and its contract terms are variants, so a card is one product and its selectors are variants. See `telecom-catalog-model`. Top-level categories are the four buyer intents; add-on subcategories exist for browsing but most add-ons are met inside the configurator of the plan they attach to.

## commercetools skills

Load `commercetools-storefront` before implementing this capability. Supporting: `commercetools-platform`. Any task generated from this spec carries `[SKILL: commercetools-storefront]`.

## Open questions

- Should the `shop/` prefix be kept for URL clarity, or should category slugs live at the locale root with a reserved-word list for non-catalog routes?
- Do the existing `product-detail-page`, `discovery-and-browse` and `search-results-page` specs get edited to remove the detail page, or archived as superseded?
- Where does home banner content live: category assets, a CMS, or custom objects?

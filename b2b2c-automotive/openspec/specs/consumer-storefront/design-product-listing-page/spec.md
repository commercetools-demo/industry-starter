<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Product listing page (category, all parts, search results)

## Purpose

The listing narrows a reseller's assortment to the parts a shopper can use. It combines vehicle fit, store stock and brand filters, and shows the reseller's price. Category browsing, "All parts" and search results use the same page so filters and cards behave the same way.

Design source: `Reseller Storefront.dc.html`, view `plp`.

## Requirements

### Requirement: Listing shows the reseller's assortment only

The system SHALL list only products assigned to the reseller's store, with the reseller's retail price and the stock of the selected store.

#### Scenario: Excluded line absent
- **GIVEN** a product the reseller withdrew from its assortment
- **WHEN** any listing or search renders
- **THEN** the product does not appear and its direct link returns not-found

#### Scenario: Reseller's own product
- **GIVEN** a product the reseller added locally
- **WHEN** the listing renders
- **THEN** it appears beside inherited products with the same card, and no "local" marker is shown to shoppers

### Requirement: Page header states context

The system SHALL show breadcrumb, the garage bar (active vehicle with Change vehicle), the title, the result count with the store city ("12 parts · prices and stock for Toronto") and a sort control.

#### Scenario: Sort options
- **GIVEN** the sort control
- **WHEN** opened
- **THEN** it offers Most popular, Price low to high, Price high to low and Top rated, and the choice is kept in the address

### Requirement: Filters held in the address

The system SHALL keep filters, sort and page in the request so a reload or shared link reproduces the page.

#### Scenario: Shared link
- **GIVEN** a listing with Fits my vehicle on, brand Brembo selected and sort by price
- **WHEN** the link is opened in a new session with a different active vehicle
- **THEN** the same brand and sort apply, and fit is evaluated against the new session's vehicle

#### Scenario: No matches
- **GIVEN** filters that match nothing
- **WHEN** the page renders
- **THEN** a dashed empty state says "No parts match these filters", the active filters stay visible and individually removable, and a clear-all control is offered

### Requirement: Filter set

The system SHALL offer Fits my vehicle, Pickup today at {city}, and Brand (with counts) in the side panel, and SHOULD add part-specific facets (position, size, material) from the product type.

#### Scenario: Brand options follow the result set
- **GIVEN** the Brakes category
- **WHEN** the filter panel renders
- **THEN** only brands present in Brakes are listed, in alphabetical order

### Requirement: Product card

The system SHALL render each card with 4:3 image, uppercase brand, name (two lines max), rating and review count, fit badge, price with old price struck through, stock line and a full-width Add to cart.

#### Scenario: No price for this shopper
- **GIVEN** a product with no price in the shopper's currency
- **WHEN** the card renders
- **THEN** it reads "Price unavailable" and Add to cart is disabled; it never shows zero

#### Scenario: Out of stock at the store
- **GIVEN** a product not available at the selected store but shippable
- **WHEN** the card renders
- **THEN** the stock line reads "Ships in 2–3 days" and Add to cart stays enabled

### Requirement: Search results

The system SHALL treat search as a listing with the query in the title, matching on part number, OE number, brand and name, with exact part-number matches ranked first.

#### Scenario: Part number search
- **GIVEN** the query "BP-2210-C"
- **WHEN** results render
- **THEN** the exact part is first, with its fit badge for the active vehicle

## Layout

1200 px column. Filter panel 230 px minimum beside a card grid with 220 px minimum cards and 16 px gap. Under about 700 px the panel collapses into a Filters button opening a sheet. Pagination or load-more is required (not in the design).

## Theming hooks

Add to cart and price use brand tokens; card border, shadow and radius use neutral and radius tokens.

## Gaps

- Design has no pagination, no mobile filter sheet, no skeleton, no search suggestions and no "no vehicle selected" state.
- Design lays out `grid-column: span 3` beside the filter panel; verify it at 1024 px.

## Platform notes

Facets are application configuration (the storefront takes only the theme from Contentools configuration). Use Product Search for listing and facets, with price and stock overlaid per request. A price facet requires embedded prices (see `commercetools-storefront` and `commercetools-platform`). Reseller channel prices must resolve for the reseller's store; confirm the price-selection model before building facets.

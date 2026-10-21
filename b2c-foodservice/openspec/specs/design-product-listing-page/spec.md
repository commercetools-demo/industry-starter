<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Product listing and search results

## Purpose

One page serves category browsing and search. It pairs a faceted filter sidebar with a product grid and keeps the shopper aware of which filters are active and how many results remain.

Design source: `ListingPage` in `pages-shop.jsx`; `filters.jsx`.

## Requirements

### Requirement: Page header

The system SHALL show breadcrumbs (Home › {category or Search}), an H1 (category name, `Results for "{query}"`, or "All products") and a count line "{n} products".

#### Scenario: Search
- **GIVEN** a query
- **WHEN** the page renders
- **THEN** a pill search input sits above the header, focused, with a clear button, and the H1 names the query

### Requirement: Facet sidebar

The system SHALL render a sticky left sidebar of collapsible groups (open by default), each with a count of selected options, a minus or plus toggle, and options with counts. Control types: checkbox (multi), radio (single, re-click clears), colour dots, and a button grid. Groups longer than six options show "Show all n".

Malva facets:

| Facet | Control | Applies to |
| --- | --- | --- |
| Category | checkbox | all |
| Machine system (Nespresso Original, Vertuo) | checkbox | pods, machines |
| Intensity (1 to 13) | button grid | pods, coffee |
| Roast (light, medium, dark) | checkbox | coffee |
| Brew method | checkbox | coffee, machines, accessories |
| Origin | checkbox | coffee |
| Decaf, organic, fairtrade | checkbox | pods, coffee |
| Colour | dots | machines, accessories |
| Price | radio bands | all |
| Rating | radio (4.5 and up, 4.0 and up) | all |
| Collection | checkbox (Bestsellers, New, Limited edition, Subscribable) | all |

#### Scenario: Faceted counts
- **GIVEN** the shopper selected Roast = dark
- **WHEN** counts recompute
- **THEN** each option's count is computed against every other active facet but not its own group, so options in the group remain comparable

#### Scenario: Dead end avoided
- **GIVEN** an option whose count is 0 and which is not selected
- **WHEN** it renders
- **THEN** it is disabled

### Requirement: Toolbar, chips and sort

The system SHALL show a toolbar with a mobile Filters button (badge with active count), an "Available at {store}" toggle chip (hidden in the Canada market, D-035) and a sort select: Featured, Price low to high, Price high to low, Top rated. Active filters show as removable chips with a "Clear all" link.

#### Scenario: Collect filter
- **GIVEN** "Available at {store}" is on
- **WHEN** the list recomputes
- **THEN** products out of stock at that store are removed and counts reflect it

#### Scenario: Canada toolbar
- **GIVEN** the Canada market is active
- **WHEN** the toolbar renders
- **THEN** the "Available at {store}" chip is absent

#### Scenario: Remove a chip
- **GIVEN** an active filter chip
- **WHEN** its x is pressed
- **THEN** that single filter clears and the list updates without scrolling to top

### Requirement: Grid and empty state

The system SHALL show product cards in a grid of 3 columns beside the sidebar (2 on mobile), and for no matches a centred search icon, "No products match these filters." and a "Clear all filters" button.

#### Scenario: Category change
- **GIVEN** the shopper navigates to another category
- **WHEN** the page renders
- **THEN** filters reset to that category only

### Requirement: Mobile filters

The system SHALL turn the sidebar into a full-height sheet under 900px, with a scrim, close button and a sticky "Show {n} results" button.

#### Scenario: Apply
- **GIVEN** the sheet is open with filters chosen
- **WHEN** "Show {n} results" is pressed
- **THEN** the sheet closes and the grid shows the filtered list

### Requirement: Shareable state

The system SHALL reflect filters, sort and page in the URL so a filtered list can be shared and the back button restores it. The prototype keeps this in memory only.

#### Scenario: Back button
- **GIVEN** the shopper opened a product from a filtered list
- **WHEN** they press back
- **THEN** the same filters and scroll position return

### Requirement: Dropped from VELA

The system SHALL NOT carry over the B2B variant table, pack-size selector or trade-account flag.

#### Scenario: B2C only
- **GIVEN** the Malva storefront
- **WHEN** a listing renders
- **THEN** it is the card grid only

## ADDED Requirements

### Requirement: Listing layout

The listing page SHALL show a kicker, a 56px category heading, and a two-column grid of a 230px sticky filter rail and the results column. Optional breadcrumbs appear above and an optional category description under the heading.

#### Scenario: Default listing
- **WHEN** a visitor opens the shop
- **THEN** the heading reads "Everything" and the rail and grid render

### Requirement: Filter rail

The filter rail SHALL provide category rows with counts, price band tags (Any price plus bands defined per currency in configuration), availability radios (Everything, In stock, Out of stock) and a "Clear all" button. The active item SHALL be filled with accent.

#### Scenario: Apply a filter
- **WHEN** a visitor selects a price band
- **THEN** the grid, result count and URL update without a full page reload

#### Scenario: Clear all
- **WHEN** a visitor activates "Clear all"
- **THEN** category, price, availability and sort return to their defaults

### Requirement: Toolbar and sort

The results column SHALL show "N products" on the left and a segmented sort (Relevance, Newest, Price ↑, Price ↓) on the right, above a divider. A single result reads "1 product".

#### Scenario: Sort by price
- **WHEN** a visitor selects "Price ↑"
- **THEN** tiles are ordered by ascending price

### Requirement: Product grid

The grid SHALL render three columns (24 products per page) of product tiles with 330px images, a heart control top-right and an "Out of stock" tag top-left when the default variant is unavailable. Stock status SHALL come from product availability data.

#### Scenario: Save from the grid
- **WHEN** a visitor clicks the heart on a tile
- **THEN** the saved state toggles and the page does not navigate

### Requirement: Applied filters, pagination and empty state

The page SHALL show removable chips for active filters, numbered pagination (Previous, pages, Next, `?page=N`) when results exceed 24 products, and when no product matches an empty state with the heading "Nothing under those terms", a "Clear filters" button and a "Contact us" link.

#### Scenario: No results
- **WHEN** the filters match nothing
- **THEN** the empty state replaces the grid and "Clear filters" restores the full list

### Requirement: Shareable listing state

Category, filters, sort and page SHALL be encoded in the URL, and returning from a product detail page SHALL restore the listing state and scroll position.

#### Scenario: Back from product
- **WHEN** a visitor opens a product and chooses Back
- **THEN** the same filters, sort and scroll position are restored

### Requirement: Facets in v1

The filter rail SHALL offer only category, price band and availability facets in v1; price bands SHALL be defined per currency in configuration (USD and EUR) and attribute facets SHALL NOT be shown.

#### Scenario: German price bands
- **WHEN** the session currency is EUR
- **THEN** bands are shown in euros from the EUR configuration

### Requirement: Weight and unit price on tiles

Tiles SHALL show the unit price per kg or litre for weighed products as specified in `weight-pricing-experience`.

#### Scenario: Weighed product tile
- **WHEN** a weighed product tile renders
- **THEN** the increment price and per-kg price are shown

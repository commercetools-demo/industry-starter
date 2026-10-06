## ADDED Requirements

### Requirement: Listing layout

The listing page SHALL show a kicker, a 56px category heading, and a two-column grid of a 230px sticky filter rail and the results column. Optional breadcrumbs appear above and an optional category description under the heading.

#### Scenario: Default listing
- **WHEN** a visitor opens the shop
- **THEN** the heading reads "Everything" and the rail and grid render

### Requirement: Filter rail

The filter rail SHALL provide category rows with counts, price band tags (Any price, Under €150, €150–400, Over €400), availability radios (Everything, In stock, Made to order) and a "Clear all" button. The active item SHALL be filled with accent.

#### Scenario: Apply a filter
- **WHEN** a visitor selects a price band
- **THEN** the grid, result count and URL update without a full page reload

#### Scenario: Clear all
- **WHEN** a visitor activates "Clear all"
- **THEN** category, price, availability and sort return to their defaults

### Requirement: Toolbar and sort

The results column SHALL show "N objects" on the left and a segmented sort (Curated, Newest, Price ↑, Price ↓) on the right, above a divider. A single result reads "1 object".

#### Scenario: Sort by price
- **WHEN** a visitor selects "Price ↑"
- **THEN** tiles are ordered by ascending price

### Requirement: Product grid

The grid SHALL render three (or four, per setting) columns of product tiles with 330px images, a heart control top-right and a "Made to order" tag top-left when applicable. Made-to-order status SHALL come from product data.

#### Scenario: Save from the grid
- **WHEN** a visitor clicks the heart on a tile
- **THEN** the saved state toggles and the page does not navigate

### Requirement: Applied filters, pagination and empty state

The page SHALL show removable chips for active filters, pagination (Previous, pages, Next) when results exceed a page, and when no product matches an empty state with the heading "Nothing under those terms", a "Clear filters" button and an "Ask a stylist" action.

#### Scenario: No results
- **WHEN** the filters match nothing
- **THEN** the empty state replaces the grid and "Clear filters" restores the full list

### Requirement: Shareable listing state

Category, filters, sort and page SHALL be encoded in the URL, and returning from a product detail page SHALL restore the listing state and scroll position.

#### Scenario: Back from product
- **WHEN** a visitor opens a product and chooses Back
- **THEN** the same filters, sort and scroll position are restored

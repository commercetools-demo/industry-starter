# Brand catalog scoping Specification

## Purpose

TBD - created by archiving change add-multibrand-malva-drinks. Update Purpose after archive.

## Requirements

### Requirement: Brand product selections
The system SHALL maintain one product selection per brand. Every Malva Coffee product SHALL belong to the coffee selection and every Malva Drinks product to the drinks selection.

#### Scenario: Coffee catalogue unchanged
- **WHEN** the seed has run
- **THEN** all existing coffee products are in `mcf-selection-malva-coffee` and none is in the drinks selection

### Requirement: Scoped product search
Product Search for listing, category, search, home, related and sitemap SHALL be restricted to the current brand's product selection.

#### Scenario: Cross-brand search
- **WHEN** a visitor on `/malva-coffee/en-US/search?q=chic` searches for a drinks product name
- **THEN** no drinks product is returned

#### Scenario: Other-brand product page
- **WHEN** a visitor opens a drinks product slug under `/malva-coffee/...`
- **THEN** the page is not found

### Requirement: Brand navigation categories
The header, mega menu, mobile navigation and category pages SHALL list only categories (and their ancestors) that contain at least one product of the brand's selection.

#### Scenario: Drinks header
- **WHEN** the visitor is on a Malva Drinks page
- **THEN** the header shows only drinks categories and no coffee category

### Requirement: Brand inventory channel
Malva Drinks products SHALL be stocked in their own inventory channel, and availability on the drinks PDP and cart SHALL be read from that channel. Malva Coffee availability SHALL be unchanged.

#### Scenario: Drinks stock
- **WHEN** a drinks SKU has 3 units in the drinks channel and none in the online entry
- **THEN** the drinks PDP shows it as low stock and allows adding at most 3

### Requirement: Brand-scoped caching
Cached public data (category tree, listings, home products) SHALL be keyed by brand.

#### Scenario: No bleed
- **WHEN** both brands' home pages are requested in turn
- **THEN** each shows only its own products

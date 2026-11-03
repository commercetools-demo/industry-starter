# Malva drinks storefront Specification

## Purpose

TBD - created by archiving change add-multibrand-malva-drinks. Update Purpose after archive.

## Requirements

### Requirement: Malva Drinks home page
The system SHALL render a Malva Drinks home page with a hero, tiles for the four product lines (French Kiss, Unflavored, Flavored Forever, Chic), an editorial strip and a promise row without any collection promise.

#### Scenario: Home content
- **WHEN** a visitor opens `/malva-drinks/en-US`
- **THEN** four product-line tiles link to their category pages and no store pickup message appears

### Requirement: Malva Drinks product page
The drinks PDP SHALL offer size options (one variant per scraped size line), the scraped images, price, availability from the drinks channel and a delivery block. It SHALL NOT offer collection or subscription.

#### Scenario: Product without image
- **WHEN** a line has no images (Strawberry, 11.15 fl oz Can)
- **THEN** the shared placeholder renders

#### Scenario: Add to bag
- **WHEN** a visitor adds a drinks product to the bag
- **THEN** the line is created with `fulfilment = delivery` and `brand = malva-drinks`

### Requirement: No store pickup for drinks
The system SHALL hide store pill, collect option and collection promise for Malva Drinks and SHALL reject a collect line for a drinks product.

#### Scenario: Collect refused
- **WHEN** the BFF receives an add-line with `fulfilment: collect` for a drinks SKU
- **THEN** it responds 400 `validation_failed` and the cart is unchanged

### Requirement: Shared listing and account pages
Malva Drinks SHALL use the shared product listing, search, cart, checkout, account and order pages, restyled by brand tokens only.

#### Scenario: PLP
- **WHEN** a visitor opens a drinks category
- **THEN** the shared listing renders with drinks products and the drinks theme

### Requirement: Drinks colour theme
Pages under `malva-drinks` SHALL use the drinks colour tokens from the brand token layer; layout, spacing and components SHALL equal Malva Coffee.

#### Scenario: Theme attribute
- **WHEN** any `/malva-drinks/...` page renders
- **THEN** the root element carries `data-brand="malva-drinks"` and text meets 4.5:1 contrast on its background

<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Home page

## Purpose

The home page gets a shopper to the right parts quickly: by vehicle first, by category second, by popularity third. It must feel like the reseller's own site while showing only what that reseller sells.

Design source: `Reseller Storefront.dc.html`, view `home`.

## Requirements

### Requirement: Vehicle-first hero

The system SHALL lead with a hero containing a headline, a supporting line stating the pickup promise for the current store, a "Shop all parts" call to action and the vehicle finder card.

#### Scenario: Pickup promise reflects the store
- **GIVEN** the selected store offers same-day pickup
- **WHEN** the hero renders
- **THEN** the supporting line says pickup in that city is available today, and for a store offering next-day pickup it says tomorrow

#### Scenario: Returning shopper with a saved vehicle
- **GIVEN** a shopper whose garage holds a vehicle
- **WHEN** the home page renders
- **THEN** the finder card shows that vehicle with Change and "Shop parts that fit", rather than empty selectors

### Requirement: Shop by category

The system SHALL show a tile for each first-level category in the reseller's assortment, each linking to the listing for that category.

#### Scenario: Tile count follows assortment
- **GIVEN** an assortment of five categories
- **WHEN** the section renders
- **THEN** five tiles show and none is empty

### Requirement: Popular products at this store

The system SHALL show four to eight popular products with image, brand, name, rating, price with strike-through old price, stock badge for the store and Add to cart.

#### Scenario: Stock badge
- **GIVEN** a product in stock at the selected store
- **WHEN** its card renders
- **THEN** a success-tinted badge reads "In stock · {city}", otherwise a warning-tinted badge reads "Ships in 2–3 days"

#### Scenario: Fitment on the home page
- **GIVEN** a selected vehicle
- **WHEN** popular products render
- **THEN** only products that fit the vehicle are shown, or non-fitting ones are labelled and not offered for direct add

### Requirement: Reseller-controlled content blocks

The system SHALL allow the reseller to replace or add content blocks (hero copy and image, promo banner, brand strip) as Contentools Puck blocks (`seller-portal/design-content-pages`). Hero, finder, category tiles and popular products are registered automotive blocks, and a default layout renders when no home page is published.

#### Scenario: Promo banner
- **GIVEN** a reseller promo "Brake season −8%"
- **WHEN** the home page renders
- **THEN** a banner appears below the hero using theme tokens, with the discount applied in cart

## Layout

Hero band (`--color-brand-deep`, 40 px vertical padding, two columns collapsing under 600 px), then 1200 px content column with 48 px section gap. Category tiles 150 px minimum, product cards 250 px minimum.

## Theming hooks

Hero band colour, accent label colour (`--color-accent-300`), tile colour (`--color-brand-deep`, hover brand-800), button radius preset.

## Gaps

- No trust strip, brand logos, or review block in the design.
- Finder card offers year, make, model, engine only; the brief requires plate and VIN entry too (see `consumer-storefront/design-vehicle-finder-and-garage`).

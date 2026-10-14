<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Product detail page

## Purpose

The detail page must answer three questions without leaving it: does it fit my vehicle, what does it cost me here, and when can I have it.

Design source: `Reseller Storefront.dc.html`, view `pdp`.

## Requirements

### Requirement: Identity, fit and price at the top

The system SHALL show breadcrumb, gallery, brand with quality label (for example "BREMBO · OEM"), name, part number, rating, a fit banner for the active vehicle, price, old price and a "Save {amount}" chip.

#### Scenario: Fit banner
- **GIVEN** an active vehicle and a fitting product
- **WHEN** the page renders
- **THEN** a success banner reads "✓ Fits your 2019 Honda Civic 2.0L", and for a non-fitting product a danger banner says it does not fit and links to fitting alternatives

#### Scenario: Price build-up for savings
- **GIVEN** a reseller price below the old price
- **WHEN** the price renders
- **THEN** the old price shows struck through and the chip shows the exact difference in the shopper's currency

### Requirement: Availability by store and by shipping

The system SHALL show stock at the selected store with its address and a Change store link, and a delivery line for shipping with the estimated days.

#### Scenario: Store changed
- **GIVEN** a shopper who changes store from the page
- **WHEN** they pick another store
- **THEN** stock, pickup promise and price (if the stores differ) update without a full reload

### Requirement: Quantity and add to cart

The system SHALL provide a quantity stepper (minimum 1) and a full-width primary Add to cart that adds the quantity and shows cart feedback.

#### Scenario: Add several
- **GIVEN** quantity 3
- **WHEN** Add to cart is pressed
- **THEN** the cart holds three units and the shopper can continue shopping or open the cart

### Requirement: Specifications, compatibility and related

The system SHALL show a specifications table, a compatible vehicles list (searchable when long), "Often bought together" with Add buttons, and the seller's returns and fulfilment line ("Sold and fulfilled by {reseller}. 30-day returns at any counter").

#### Scenario: Long compatibility list
- **GIVEN** a part that fits more than 20 vehicles
- **WHEN** the section renders
- **THEN** the first ten show with a filter box and "Show all"

### Requirement: Reseller-tailored text, locked data

The system SHALL show the reseller's tailored name and description when present and the master text otherwise, and SHALL never let tailoring alter part number, fitment or specifications.

#### Scenario: Tailored description
- **GIVEN** a reseller description approved for the product
- **WHEN** the page renders
- **THEN** the reseller text shows, with the mandatory fitment disclaimer beneath it

## Layout

Two columns from 680 px (gallery left, buy box right, 40 px gap), one column below. Specifications and compatibility share a white bordered panel. Related items in 220 px cards.

## Theming hooks

Price colour, fit banner structure, Add to cart and chip colours.

## Gaps

- Design has no reviews list, Q&A, delivery cut-off, warranty detail, sticky mobile buy bar, image zoom or video.
- Gallery thumbnails are placeholders without behaviour.

## Platform notes

Reseller text maps to product tailoring (see `commercetools-commerce-patterns`, catalog architecture).

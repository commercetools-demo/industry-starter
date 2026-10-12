<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Cart page

## Purpose

The cart confirms what the shopper will pay and how they will receive it. It is where the delivery choice (pickup or ship) is made visible, and where discounts are named.

Design source: `Reseller Storefront.dc.html`, view `cart`.

## Requirements

### Requirement: Lines with editable quantity

The system SHALL list each line with image, brand, name, stock line, quantity stepper (minimum 1), Remove and line total.

#### Scenario: Quantity change updates totals
- **GIVEN** a line with quantity 1
- **WHEN** the shopper presses +
- **THEN** the line total and order summary update within the same interaction and the header cart count changes

#### Scenario: Stock cannot cover quantity
- **GIVEN** a requested quantity above the store's stock but shippable
- **WHEN** the line renders
- **THEN** the line states which part ships from the store and which part ships later, or caps the quantity if neither is possible

### Requirement: Delivery method with visible consequences

The system SHALL offer Pick up (free, with store name, city and time) and Ship to me (with the fee and "free over {threshold}"), and SHALL update delivery fee and tax when the choice changes.

#### Scenario: Pickup chosen
- **GIVEN** pickup selected
- **WHEN** the summary renders
- **THEN** delivery shows Free and the store and time appear in the selected option

#### Scenario: Shipping below threshold
- **GIVEN** shipping selected and subtotal below the threshold
- **WHEN** the summary renders
- **THEN** the fee is added, and the option label shows how much more earns free shipping

### Requirement: Named savings and promo code

The system SHALL show each discount as its own named line (for example "Brake season −8%") and accept a promo code with a state of Applied or Not applied and the reason.

#### Scenario: Code that does not match
- **GIVEN** a code that does not apply to the cart
- **WHEN** it is applied
- **THEN** the code shows "Not applied" with the reason and can be removed, and totals do not change

### Requirement: Summary with tax and total

The system SHALL show subtotal, delivery, tax (label and rate from the store's tax configuration) and total, and a Checkout button.

#### Scenario: Tax label follows the store
- **GIVEN** a store in Germany
- **WHEN** the summary renders
- **THEN** the tax line reads "VAT (19%)" with prices shown tax-inclusive per store configuration

### Requirement: Empty cart

The system SHALL show a dashed empty state with a Browse parts button.

#### Scenario: Empty
- **GIVEN** no lines
- **WHEN** the page renders
- **THEN** "Your cart is empty." and Browse parts are shown and the summary is hidden

## Layout

Two columns from 680 px: lines (span two) and a sticky summary. Line grid is 96 px image, flexible text, price.

## Theming hooks

Line total colour, selected delivery border and fill (brand and brand-50), Checkout button.

## Gaps

- Design hard-codes "HST (13%)" and "$" (Canada). Currency, locale, tax label and threshold must come from the store.
- No save-for-later, no mini-cart drawer, no cross-sell, no cart-level fit warning if the vehicle changes after items were added (needed: warn on lines that no longer fit).

## Platform notes

Cart and order carry the reseller's store. Direct discounts block discount codes; do not mix them on a cart (see `commercetools-commerce-patterns`). Name each applied discount from the cart's discount data.

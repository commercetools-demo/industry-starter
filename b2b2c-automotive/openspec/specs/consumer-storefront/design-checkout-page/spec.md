<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Checkout page

## Purpose

> **Scope note (owner, 2026-10-12):** the hosted commercetools Checkout widget with Stripe replaces the three numbered sections and the Place order button; the layout deviation is accepted pending M-O04.

Checkout turns a cart into an order in three short sections on one page: contact, delivery, payment. It supports guests and signed-in shoppers and handles both pickup and delivery.

Design source: `Reseller Storefront.dc.html`, view `checkout`.

## Requirements

### Requirement: Single page, three numbered sections

The system SHALL present "1 · Contact", "2 · Delivery", "3 · Payment" in order beside an order summary, and SHALL not allow Place order until each section is valid.

#### Scenario: Incomplete section
- **GIVEN** a missing email
- **WHEN** the shopper presses Place order
- **THEN** focus moves to the email field with an inline message and no order is created

### Requirement: Contact

The system SHALL collect email and mobile (labelled "Mobile (pickup alerts)") and, for a signed-in shopper, prefill them.

#### Scenario: Guest checkout
- **GIVEN** a shopper who is not signed in
- **WHEN** they enter email and continue
- **THEN** they can complete the order as a guest and are offered account creation on the confirmation page

### Requirement: Delivery by pickup or shipping

The system SHALL let the shopper choose Pick up (shows store address, hours and "Bring photo ID") or Ship to me (shows full name, street, city and postal code fields), carrying over the choice from the cart.

#### Scenario: Pickup details
- **GIVEN** pickup selected
- **WHEN** the section renders
- **THEN** a quiet panel shows address, opening hours and the ID reminder, and no address fields are asked

#### Scenario: Address validation
- **GIVEN** shipping selected with an invalid postal code
- **WHEN** the field loses focus
- **THEN** an inline message shows the expected format for the country

### Requirement: Payment

The system SHALL take payment through the reseller's configured payment provider using hosted or embedded fields so card data never touches the storefront.

#### Scenario: Declined payment
- **GIVEN** a declined card
- **WHEN** the shopper presses Place order
- **THEN** the order is not created, the cart is kept and the shopper sees a plain message with the option to try another method

### Requirement: Summary and placement

The system SHALL show lines with quantity, subtotal, delivery, tax and total, a "Place order · {total}" button and a "Back to cart" link.

#### Scenario: Total on the button
- **GIVEN** a total of $128.45
- **WHEN** the button renders
- **THEN** it reads "Place order · $128.45" in the store's currency format

#### Scenario: Double submit
- **GIVEN** the shopper presses Place order twice
- **WHEN** the second press arrives
- **THEN** only one order exists

## Layout

Two columns from 680 px, sections as white bordered cards with 20 px padding and 12 px gap; fields 44 px.

## Theming hooks

Selected delivery option, Place order button, section titles.

## Gaps

- Design shows raw card inputs; replace with provider-hosted fields.
- No express wallet buttons, no billing address, no terms checkbox, no error states, no order-review step.
- Design checkout is hard-coded CAD and HST.

## Platform notes

If using commercetools Checkout, load `commercetools-checkout`; otherwise `commercetools-storefront` checkout. Provide idempotency on order creation.

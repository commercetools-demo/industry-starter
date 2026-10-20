<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Cart page

## Purpose

The cart is where omnichannel becomes visible: one bag, lines grouped by how they will reach the shopper, each switchable between collection and delivery, with a summary that tells the truth about shipping and tax before checkout.

Design source: `CartPage` in `pages-checkout.jsx`.

## Requirements

### Requirement: Grouped by fulfilment

The system SHALL split lines into groups with an icon heading: "Collect · {store}" (with address, readiness time and a Change store link), "Shipping to you" (with threshold and delivery window), and "Subscriptions" (new; delivers every {interval}, next date shown). A group with no lines is omitted.

#### Scenario: Mixed bag
- **GIVEN** a bag with a machine for delivery and capsules for collection
- **WHEN** the cart renders
- **THEN** two groups show, each with its own heading and promise

### Requirement: Line item

The system SHALL show per line a 96x116 image, name, line total, variant summary, a Collect or Ship chip pair (active ink), a stepper and Remove. Switching fulfilment moves the line to the other group, merging with an identical line if present. A collect line out of stock at the store shows an amber "Not in stock at {store}, try shipping".

#### Scenario: Switch to ship
- **GIVEN** a collect line out of stock at the store
- **WHEN** the shopper chooses Ship
- **THEN** the line moves to Shipping and the warning disappears

#### Scenario: Merge
- **GIVEN** the same item exists as a ship line
- **WHEN** another line is switched to Ship
- **THEN** quantities merge into one line

### Requirement: Order summary

The system SHALL show a sticky card (96px offset) with Subtotal, Shipping (Free or amount), Estimated tax, Total, a "Checkout" button, a secure-checkout note and a gift-note prompt. Under 900px the summary follows the lines.

#### Scenario: Tax presentation
- **GIVEN** the market uses tax-inclusive prices
- **WHEN** the summary renders
- **THEN** it shows "Includes {tax} VAT" instead of an added estimate; VELA's flat 8.875% added tax is a US placeholder

### Requirement: Empty state

The system SHALL show a centred bag icon, "Your bag is empty", a short line and a "Shop coffee" button.

#### Scenario: Removing the last line
- **GIVEN** one line remains
- **WHEN** it is removed
- **THEN** the empty state renders

### Requirement: Machine and capsule nudge

The system SHALL, when the bag holds a machine and no compatible capsules, offer a one-line suggestion with an add button (new design).

#### Scenario: Starter capsules
- **GIVEN** only a Vertuo machine in the bag
- **WHEN** the cart renders
- **THEN** a suggestion offers compatible capsules, and adding them updates the totals in place

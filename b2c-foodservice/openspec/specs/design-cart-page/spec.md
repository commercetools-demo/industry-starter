<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Cart page

## Purpose

The cart is where omnichannel becomes visible: one bag, lines grouped by how they will reach the shopper, each switchable between collection and delivery, with a summary that tells the truth about shipping and tax before checkout.

Design source: `CartPage` in `pages-checkout.jsx`.

## Requirements

### Requirement: Grouped by fulfilment

The system SHALL split lines into fulfilment clusters with an icon heading: "Collect at {store}" (with address, readiness time and a Change store link; US market only), "Delivery" (standard carrier, with threshold and delivery window), and "Subscription" (new; delivers every {interval}, next date shown). A cluster with no lines is omitted. In the Canada market only the Delivery and Subscription clusters exist.

#### Scenario: Mixed bag
- **GIVEN** a US bag with a machine for delivery, capsules for collection and a subscribed coffee
- **WHEN** the cart renders
- **THEN** three clusters show, each with its own heading and promise, and every line sits inside exactly one cluster

### Requirement: Mixed bags are shown clearly

The system SHALL support a single bag holding collect, delivery and subscription lines at once (D-033) and SHALL mark each line inside its cluster so the shopper can tell at a glance how it will reach them: the cluster heading carries the fulfilment name and, for collection, the store; each line also repeats a fulfilment chip ("Collect at {store}", "Delivery", "Subscription · every {interval}") so the line stays unambiguous when seen alone (for example in a screenshot or a screen reader).

#### Scenario: Lines are labelled
- **GIVEN** a bag with one collect line and one delivery line
- **WHEN** the cart renders
- **THEN** the collect line sits under "Collect at {store}" and shows a "Collect at {store}" chip, and the delivery line sits under "Delivery" and shows a "Delivery" chip

#### Scenario: Changing a line moves it
- **GIVEN** a mixed bag
- **WHEN** the shopper changes a line from Collect to Delivery
- **THEN** the line moves to the Delivery cluster, its chip updates, and totals recompute

#### Scenario: Canada market
- **GIVEN** the Canada market is active
- **WHEN** the cart renders
- **THEN** no Collect cluster and no Collect chip appear, and a note explains that collection is available in the US market only

### Requirement: Line item

The system SHALL show per line a 96x116 image, name, line total, variant summary, a fulfilment chip pair (Collect and Delivery, active ink; Collect is absent in the Canada market), a stepper and Remove. Switching fulfilment moves the line to the other cluster, merging with an identical line if present. A collect line out of stock at the store shows an amber "Not in stock at {store}, try delivery".

#### Scenario: Switch to delivery
- **GIVEN** a collect line out of stock at the store
- **WHEN** the shopper chooses Delivery
- **THEN** the line moves to the Delivery cluster and the warning disappears

#### Scenario: Merge
- **GIVEN** the same item exists as a delivery line
- **WHEN** another line is switched to Delivery
- **THEN** quantities merge into one line

### Requirement: Order summary

The system SHALL show a sticky card (96px offset) with Subtotal, Shipping (Free or amount; standard carrier only), Estimated tax, Total, a "Checkout" button that hands off to the hosted Checkout (`design-checkout-page`), a secure-checkout note and a gift-note prompt. Under 900px the summary follows the lines.

#### Scenario: Tax presentation
- **GIVEN** the US or the Canada market is active
- **WHEN** the summary renders
- **THEN** prices are tax-exclusive in both markets and the summary shows an added "Estimated tax" line (D-036: US food 0%, standard 8%, NY 8.875%; Canada food 0%, standard 5% GST, no provincial tax modelled), never a "tax included" wording

### Requirement: Promo codes

The system SHALL offer a Promo codes field on the cart page with Add and Enter support; applied codes are teal pills (mono code, label, saving, remove x) and stack, and the summary shows a Discount line (teal, negative). Codes are applied to the cart by the storefront before hand-off, because the hosted Checkout is not relied on for code entry.

#### Scenario: Invalid code
- **GIVEN** an unknown code is entered
- **WHEN** Add is pressed
- **THEN** an inline red message says the code is not valid and nothing changes

#### Scenario: Duplicate code
- **GIVEN** a code is already applied
- **WHEN** it is added again
- **THEN** a message says it is already applied

#### Scenario: Remove a code
- **GIVEN** an applied code
- **WHEN** its x is pressed
- **THEN** the discount and total recompute

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

<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Order confirmation page

## Purpose

Confirmation is a storefront page the hosted Checkout returns to (D-039). It reassures the shopper the order exists, reads everything from the order in commercetools, and, for collection, tells them exactly what happens next and what to bring. No email is sent (D-032).

Design source: `ConfirmationPage` in `pages-account.jsx`.

## Requirements

### Requirement: Confirmation header

The system SHALL show a 760px centred page with a 64px teal check circle, "Order confirmed", and "Order {number}" with the number in mono, plus the contact email recorded on the order. The page SHALL NOT say a confirmation email was sent.

#### Scenario: Return from hosted Checkout
- **GIVEN** the hosted flow returns with an order id
- **WHEN** the page renders
- **THEN** it loads that order by id, shows its number and contact email, and the cart is already cleared

#### Scenario: Guest
- **GIVEN** a guest placed the order
- **WHEN** the page renders
- **THEN** it shows the email used and offers to create an account, which signs them in immediately with no verification step

### Requirement: Collection status

The system SHALL, when any line is collected (US market only; the Canada market is delivery only), show a card "Collect at {store}" with a four-node tracker (Ordered, Preparing, Ready, Collected; done teal, active violet), then a tinted block with the address and what to bring.

#### Scenario: Status progress
- **GIVEN** the order moves to Ready
- **WHEN** the page or the account order is opened
- **THEN** the tracker shows Ready as active and the earlier nodes as done

### Requirement: Delivery and subscription notes

The system SHALL, for shipped lines, show the standard-carrier delivery estimate and tracking link once available, and for subscription lines the next delivery date and a Manage link to the account. New design (VELA tracks pickup only).

#### Scenario: Shipped line
- **GIVEN** a shipped line with no tracking yet
- **WHEN** the card renders
- **THEN** it shows the estimated window and "Tracking will appear here"

### Requirement: Mixed orders

The system SHALL show a mixed order (D-033) as one confirmation with a section per fulfilment cluster ("Collect at {store}", "Delivery", "Subscription"), each line repeating its fulfilment chip.

#### Scenario: Mixed order
- **GIVEN** an order with collect and delivery lines
- **WHEN** the page renders
- **THEN** a Collect section with the tracker and a Delivery section with the estimate both show, and each item sits in its own section

### Requirement: Items and totals

The system SHALL list items (60x72 image, name, variant, quantity, fulfilment, price) and tax-exclusive totals (subtotal, tax, total), then "View in My Account" and "Keep shopping".

#### Scenario: No recent order
- **GIVEN** the page is opened without a recent order
- **WHEN** it renders
- **THEN** it shows "No recent order" with a Shop button

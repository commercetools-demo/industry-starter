<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Order confirmation page

## Purpose

Confirmation reassures the shopper the order exists and, for collection, tells them exactly what happens next and what to bring.

Design source: `ConfirmationPage` in `pages-account.jsx`.

## Requirements

### Requirement: Confirmation header

The system SHALL show a 760px centred page with a 64px teal check circle, "Order confirmed", and "Order {number} · confirmation sent to {email}" with the number in mono.

#### Scenario: Guest
- **GIVEN** a guest placed the order
- **WHEN** the page renders
- **THEN** it shows the email used and offers to create an account from the order

### Requirement: Collection status

The system SHALL, when any line is collected, show a card "Collect at {store}" with a four-node tracker (Ordered, Preparing, Ready, Collected; done teal, active violet), then a tinted block with the address and what to bring.

#### Scenario: Status progress
- **GIVEN** the order moves to Ready
- **WHEN** the page or the account order is opened
- **THEN** the tracker shows Ready as active and the earlier nodes as done

### Requirement: Delivery and subscription notes

The system SHALL, for shipped lines, show the delivery estimate and tracking link once available, and for subscription lines the next delivery date and a Manage link to the account. New design (VELA tracks pickup only).

#### Scenario: Shipped line
- **GIVEN** a shipped line with no tracking yet
- **WHEN** the card renders
- **THEN** it shows the estimated window and "Tracking will appear here"

### Requirement: Items and totals

The system SHALL list items (60x72 image, name, variant, quantity, fulfilment, price) and the total, then "View in My Account" and "Keep shopping".

#### Scenario: No recent order
- **GIVEN** the page is opened without a recent order
- **WHEN** it renders
- **THEN** it shows "No recent order" with a Shop button

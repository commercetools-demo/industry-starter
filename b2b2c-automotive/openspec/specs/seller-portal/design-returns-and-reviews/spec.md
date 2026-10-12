<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Returns and reviews

## Purpose

Resellers handle returns from their shoppers and answer reviews on their products.

Design source: `Malva Seller Portal.dc.html`, pages `returns` and `reviews`.

## Requirements

### Requirement: Returns list

The system SHALL list returns with number, order, customer, items, tracking and status (Requested, In transit, Received, Refunded), with tabs Open and Closed and KPIs (Open returns, Return rate, Refunded this month).

#### Scenario: Status tones
- **GIVEN** statuses Requested, In transit, Refunded
- **WHEN** chips render
- **THEN** they are warning, info and success tinted

### Requirement: Record a return

The system SHALL create a return from order number, items and quantities and optional comment, generate a tracking ID and confirm "Return {id} created, tracking {tracking}".

#### Scenario: Invalid order
- **GIVEN** an order not belonging to the reseller
- **WHEN** submitted
- **THEN** it is refused as not found

### Requirement: Return lifecycle

The system SHALL move a return through Requested → Received → Inspected → Refunded or Rejected, with refund amount and reason, and notify the shopper at each step.

#### Scenario: Refund
- **GIVEN** a received return passing inspection
- **WHEN** Refund is confirmed
- **THEN** the amount is refunded to the original payment and the shopper's account shows Refunded

### Requirement: Fitting-related returns (later phase)

The system SHALL flag a return whose reason is "wrong fit" and show the vehicle selected at purchase.

#### Scenario: Wrong fit
- **GIVEN** a return reason "does not fit"
- **WHEN** the detail opens
- **THEN** the vehicle chosen at purchase and the fit result shown then are visible

### Requirement: Reviews

The system SHALL list reviews with product, star rating, text, customer and date, tabs Latest, Highest, Lowest, KPIs (Average rating, This month, Unanswered), and allow a public reply and moderation.

#### Scenario: Reply
- **GIVEN** an unanswered 2-star review
- **WHEN** the reseller posts a reply
- **THEN** the reply shows on the product page under the review and Unanswered decreases

## Gaps

- No return detail page, no return label or policy settings, no photo evidence; reviews have no moderation or reply UI.
- Return window setting is not designed.

## Platform notes

Returns map to order return info; reviews to review resources. Confirm which are native (load `commercetools-platform`) before designing fields.

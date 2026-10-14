<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Order confirmation page

## Purpose

> **Scope note (owner, 2026-10-12):** the Confirmation email requirement is out of scope: no emails are sent anywhere in this project.

After payment the shopper needs to know the order exists, what happens next and where to pick it up or when it arrives.

Design source: `Reseller Storefront.dc.html`, view `done`.

## Requirements

### Requirement: Confirmation states the next step

The system SHALL show a success mark, the heading "Thanks, your order is in.", the order number, and a sentence that depends on delivery method.

#### Scenario: Pickup
- **GIVEN** a pickup order
- **WHEN** the page renders
- **THEN** it says the shopper will be texted when it is ready at the store and city

#### Scenario: Shipping
- **GIVEN** a shipped order
- **WHEN** the page renders
- **THEN** it says shipping from the store and the delivery window

### Requirement: Order number comes from the order

The system SHALL display the real order number from the created order, never a placeholder.

#### Scenario: Refresh
- **GIVEN** the confirmation page
- **WHEN** it is refreshed or opened from the email link
- **THEN** it shows the same order, readable by the buyer only

### Requirement: Follow-up actions

The system SHALL offer Continue shopping, View order (signed-in) or Create account (guest, email prefilled).

#### Scenario: Guest account offer
- **GIVEN** a guest order
- **WHEN** the shopper chooses Create account
- **THEN** only a password is asked and the order attaches to the new account

### Requirement: Confirmation email

The system SHALL send a confirmation email using the reseller's theme and template (see `seller-portal/design-marketing-and-email`).

#### Scenario: Email branded
- **GIVEN** a reseller with a logo and brand colour
- **WHEN** the email is sent
- **THEN** it shows that logo and colour and the store's pickup or delivery details

## Gaps

- Design shows only the heading, note and one button; order summary, address and next-step timeline are needed.
- Order number "AL-48213" is a literal in the design.

<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Cart design

## Purpose

The cart holds prescription medications selected on the lookup page, grouped by the prescription they came from. It is short-lived and has no quantity editing: quantity is whatever the doctor prescribed. That makes the cart's job mostly to show an honest total and to refuse medicines that are no longer dispensable by the time the patient gets here.

Design reference: `design/DESIGN.md`; source `design/source/app-rx.jsx` (`Cart`). Behavioral base: `cart-page`, `cart-management`, `prescription-bound-supply`, `dispensing-quantity-limit`.

## Requirements

### Requirement: Cart page layout

The system SHALL render `/cart` for a signed-in patient with a page head "Your cart", a two-column layout (lines left, 380px summary right when the cart has lines).

#### Scenario: Lines
- **GIVEN** a cart with lines
- **WHEN** it renders
- **THEN** each row shows medication name, "<RX number> · Qty N", the price and a "Remove" action (a real button)

#### Scenario: Summary
- **GIVEN** a cart with lines
- **WHEN** the summary renders
- **THEN** it shows Subtotal, "Standard delivery" with a green FREE badge (or the calculated fee), Total (navy, 20px bold) and a full-width "Checkout" button to `/checkout`; the summary shows no number the platform did not calculate

#### Scenario: Empty cart
- **GIVEN** an empty cart
- **WHEN** it renders
- **THEN** only the lines card shows "Your cart is empty." with a "Find a prescription" button to `/prescriptions`, and no summary

#### Scenario: Anonymous visitor
- **GIVEN** no session
- **WHEN** `/cart` opens
- **THEN** the sign-in card appears with "Sign in to view your cart." and returns to the cart afterwards

### Requirement: Remove lines with prices recalculated

The system SHALL remove a line when its Remove action is activated and SHALL recalculate the totals from the platform.

#### Scenario: Remove
- **GIVEN** a cart with three lines
- **WHEN** one is removed
- **THEN** it disappears, the header count and totals update, and the toast/live region announces "Removed <name>"

#### Scenario: Last line removed
- **GIVEN** one line
- **WHEN** it is removed
- **THEN** the empty state shows

### Requirement: Lines that stopped being dispensable

The system SHALL re-validate every line when the cart loads and SHALL block checkout for lines that fail.

#### Scenario: Prescription expired or refills used
- **GIVEN** a line whose prescription is no longer valid for dispensing
- **WHEN** the cart renders
- **THEN** the row shows the reason, the Checkout button is disabled until the line is removed, and the total excludes it (states not designed; prototype has none)

#### Scenario: Price changed
- **GIVEN** a medication price changed since it was added
- **WHEN** the cart renders
- **THEN** the new price is shown with a "Price updated" note

### Requirement: No quantity editing

The system SHALL NOT offer quantity controls on prescription lines.

#### Scenario: Quantity shown read-only
- **GIVEN** a line with prescribed quantity 21
- **WHEN** it renders
- **THEN** quantity is shown as text "Qty 21" and cannot be changed in the cart

## Components

| Component | Data source |
| --- | --- |
| Line row, Remove | middleware (cart) |
| Summary | middleware (cart totals) |
| Empty state | static |

## commercetools

Entities: `Cart` with `LineItem`s for medications; the RX number and medication id as line item custom fields (type with `rxNumber`); delivery as `shippingInfo` from a `ShippingMethod`. Totals come from the cart's `totalPrice`/`taxedPrice`, never summed client-side (the prototype sums `price` in the browser). Dispensing validity is enforced by the capabilities named in the base list.

## commercetools skills

Load `commercetools-storefront`. Supporting: `commercetools-commerce-patterns`.

## Open questions

- One cart for medications only, or may doctor bookings join it (D1)?
- Do prescription lines need a taxed/exempt breakdown in the summary?

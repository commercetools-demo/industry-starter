<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Cart drawer

## Purpose

The drawer lets a shopper review and adjust the bag without leaving the page, and makes the free-shipping goal visible while they decide whether to add one more thing.

Design source: `CartDrawer` in `components.jsx`.

## Requirements

### Requirement: Drawer content

The system SHALL open a 440px right drawer headed "Your bag (n)" with a close button, a free-shipping progress block, line items, and a footer holding Subtotal, a primary "View bag" button and a ghost "Checkout" button.

#### Scenario: Below the threshold
- **GIVEN** a subtotal under the free-shipping threshold
- **WHEN** the drawer opens
- **THEN** it shows "Add {remaining} for free shipping" with a teal progress bar

#### Scenario: Threshold reached
- **GIVEN** a subtotal at or above the threshold
- **WHEN** the drawer opens
- **THEN** the block becomes a teal "You've unlocked free shipping" line

### Requirement: Line item

The system SHALL show per line a 84x100 image, name, line total, variant summary (for example "Intensity 8 · 10 capsules", "250 g · Whole bean"), a fulfilment line (collect at {store}, ship to me, or delivers every {interval}), a stepper and a Remove link.

#### Scenario: Quantity floor
- **GIVEN** a line with quantity 1
- **WHEN** the minus control is pressed
- **THEN** the quantity stays at 1; removal is only through Remove

### Requirement: Empty state

The system SHALL show a centred bag icon, "Your bag is empty" and a "Start shopping" button.

#### Scenario: Last line removed
- **GIVEN** the drawer holds one line
- **WHEN** it is removed
- **THEN** the empty state replaces the list without closing the drawer

### Requirement: Stock and price changes

The system SHALL mark a line whose item became unavailable or whose price changed since it was added, with a message on the line, rather than silently altering the total.

#### Scenario: Price changed
- **GIVEN** a price changed after the line was added
- **WHEN** the drawer opens
- **THEN** the line shows the new price with "Price updated"

<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Product card

## Purpose

The product card is the unit of every grid (home, listing, search, related, saved). It must show enough to decide to open or quick-add, including whether the item can be collected from the shopper's store.

Design source: `ProductCard`, `Swatches`, `PickupBadge`, `Rating` in `components.jsx`.

## Requirements

### Requirement: Card anatomy

The system SHALL render a 5:6 rounded image area, then category (11px uppercase), name (Archivo 600, 15.5px), a row with price and swatches, and an availability line. On hover the image gains a soft shadow, a heart appears top right and a "Quick add" button slides up from the bottom of the image.

#### Scenario: Hover
- **GIVEN** a pointer over a card
- **WHEN** the card is hovered
- **THEN** the heart and Quick add appear within 200ms and the card remains a single click target for the detail page

#### Scenario: Touch
- **GIVEN** a touch device
- **WHEN** the card renders
- **THEN** the heart and Quick add are always visible, since hover does not exist

### Requirement: Badge

The system SHALL show at most one badge, top left: Bestseller (ink), New (accent). Malva adds Limited edition and Subscribe & save as further values.

#### Scenario: Multiple qualifying flags
- **GIVEN** a product is both new and a bestseller
- **WHEN** the card renders
- **THEN** one badge shows, by a fixed precedence

### Requirement: Price and variants

The system SHALL show "From {price}" when variants differ in price, and a unit price where the pack size matters (per capsule, per 100 g). Swatches are shown only for products whose variants differ by colour (machines, cups); pods and coffee show the intensity or roast as a small label instead of swatches.

#### Scenario: Pods
- **GIVEN** a pod sleeve of 10 capsules at 4.90
- **WHEN** the card renders
- **THEN** it shows the sleeve price and "0.49 per capsule", and an intensity label

### Requirement: Availability line

The system SHALL show a dot and text for the shopper's collection store: In stock at {store} (teal), Low stock at {store} (amber), Not available at {store} (stone). With no store chosen it shows a "Choose a store" link instead.

#### Scenario: Out at the store
- **GIVEN** the item is out of stock at the chosen store
- **WHEN** the card renders
- **THEN** the line reads "Not available at {store}" and the card is still openable and shippable

### Requirement: Quick add

The system SHALL add the default variant with default fulfilment when the product has no required choice, and SHALL open the product page instead when a choice is required (grind for coffee, machine colour). The prototype always adds a default size; Malva does not guess a grind.

#### Scenario: Required choice
- **GIVEN** a coffee product requiring a grind
- **WHEN** Quick add is pressed
- **THEN** the detail page opens with the choice highlighted, and nothing is added

### Requirement: Save

The system SHALL toggle a product in the shopper's saved items from the heart, with `aria-label` "Save", filled accent when saved.

#### Scenario: Guest
- **GIVEN** a guest presses the heart
- **WHEN** the action fires
- **THEN** the item is kept for the session and offered for the account on sign-in

<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Product discounts, cart discounts and discount priority

## Purpose

> **Scope note (owner, 2026-10-12):** a discount that takes a price below cost shows a warning only; there is no price floor.

Resellers run their own promotions on top of Malva pricing. Product discounts change a part's price; cart discounts change the cart or shipping. Order of application matters and must be visible and controllable within limits.

Design source: `Malva Seller Portal.dc.html`, page `catalog`, tabs "Product discounts", "Cart discounts", "Discount priority".

## Requirements

### Requirement: Discount lists

The system SHALL list discounts with name, scope ("Category · Brakes", "MLV-WB-90015", "Customer group", "Cart total ≥ €2,000"), effect ("−8%", "−€2.00 / unit", "Shipping €0"), run window and an Active toggle, and provide "New product discount" and "New cart discount".

#### Scenario: Toggle
- **GIVEN** an active discount
- **WHEN** its toggle is switched off
- **THEN** it stops applying to new carts and remains listed

#### Scenario: Draft
- **GIVEN** "New cart discount"
- **WHEN** pressed
- **THEN** a draft "New cart rule (draft)" appears inactive and unscheduled, to be completed in an editor

### Requirement: Order of application

The system SHALL state the order "Malva price → your override → product discounts → cart discounts", and SHALL show Malva-funded promotions fixed at the top of the priority list, locked and not editable.

#### Scenario: Locked row
- **GIVEN** a Malva-funded "Spring clearance"
- **WHEN** the priority tab renders
- **THEN** it shows type Malva, rank "—", reduced opacity and "Locked", with no move buttons

### Requirement: Priority within a kind

The system SHALL rank discounts of the same kind (Product, Cart) with up/down controls, keep product discounts always ahead of cart discounts, and save by writing a sort order per discount.

#### Scenario: Move within kind only
- **GIVEN** product discounts ranked 1–3 and cart discounts ranked 1–2
- **WHEN** a product discount is moved down past the last product discount
- **THEN** it stops and does not enter the cart group

### Requirement: Promo codes visible with reasons

The system SHALL, when a code is applied to a cart, show per code Applied or "Not applied: cart doesn't match", and name each saving.

#### Scenario: Wrong cart
- **GIVEN** code BRAKE5 on a cart without brake parts
- **WHEN** applied
- **THEN** it shows "Not applied: cart doesn't match" and totals stay

### Requirement: Safe discounts

The system SHALL warn when a discount would take a price below the Malva price floor or below cost, and block it where the floor is violated.

#### Scenario: Floor
- **GIVEN** a product discount of −15% on a part with a 12% allowed band
- **WHEN** saving
- **THEN** it is blocked with the allowed maximum

### Requirement: Editor for rules

The system SHALL provide an editor for each discount (target, condition, effect, schedule, stacking, code if any) with preview on a sample cart.

#### Scenario: Preview
- **GIVEN** a draft "−3% on cart ≥ €2,000"
- **WHEN** previewed on a €2,500 sample cart
- **THEN** the sample shows −€75 as a named line

## Gaps

- Editors are not designed; only lists, toggles and a draft stub exist. Conditions need a rule builder with plain-language output.
- Malva-funded campaigns (Marketing page) create discounts that this page must show as locked.

## Platform notes

Product discounts and cart discounts have sort orders (higher fires first) and cart discounts stack unless stopped; direct discounts block codes (see `commercetools-commerce-patterns`). The portal's "rank 1 first" is a presentation of that value; map and test the direction. Product discounts do not work with external pricing.

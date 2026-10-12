<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Price overrides and margin (reseller retail prices)

## Purpose

> **Scope note (owner, 2026-10-12):** there is no MAP price floor; resellers may set any price above zero.

Malva sets base pricing; each reseller sets its own retail price for the parts it sells. The portal must make margin obvious and enforce Malva's price floor.

Design source: `Malva Seller Portal.dc.html`, page `catalog`, tab "Price overrides"; "Brand partnership" for the floor.

## Requirements

### Requirement: One price per part per reseller store

The system SHALL let the reseller enter its retail price per assigned, priced part, falling back to the Malva list price when left blank, and SHALL show the Malva list price, the reseller's cost and the entered price side by side.

| Column | Meaning |
| --- | --- |
| Product | Name and part number |
| Malva list | Master list price |
| Your cost | Reseller's cost from Malva (or its own cost for local parts) |
| Your price | Input, placeholder shows the list price |
| Margin | Chip |

#### Scenario: Blank input
- **GIVEN** no override for a part
- **WHEN** the storefront prices it
- **THEN** it uses the Malva list price

### Requirement: Margin feedback

The system SHALL compute margin as (price − cost) ÷ price and show it as a chip: success at 8% or more, warning below 8% ("thin"), critical below cost ("below cost").

#### Scenario: Thin margin
- **GIVEN** a price giving 5% margin
- **WHEN** the chip renders
- **THEN** it shows "5.0% · thin" in a warning tint

#### Scenario: Below cost
- **GIVEN** a price below cost
- **WHEN** the chip renders
- **THEN** it shows a critical "below cost" label and the save control asks for confirmation

### Requirement: Price floor from Malva

The system SHALL block publishing any price below the minimum advertised price (88% of Malva list in the design), show "Below MAP floor €{floor}", and keep showing shoppers the Malva price for a violating part until fixed.

#### Scenario: Violation flagged
- **GIVEN** an override of €79.00 for a part listed at €94.50
- **WHEN** the table renders
- **THEN** the chip is critical "Below MAP floor €83.16" and the Brand partnership page lists it under Flagged for you

### Requirement: Order of price layers

The system SHALL state the order: Malva price → reseller override → product discounts → cart discounts, with Malva-funded promotions first and not editable.

#### Scenario: Promotion over override
- **GIVEN** a Malva-funded 10% promotion and a reseller override
- **WHEN** the shopper sees the price
- **THEN** the promotion applies to the override price in that order

### Requirement: Bulk editing and safe publish

The system SHOULD allow percentage-based and CSV bulk edits with a preview of resulting margins, and SHALL publish price changes only after confirmation with the count of changed parts.

#### Scenario: Preview
- **GIVEN** "set to list +8%" on 120 parts
- **WHEN** the preview opens
- **THEN** it shows the new price and margin per part and flags floor and below-cost cases before publishing

## Gaps

- No scheduling (valid from/until), no per-branch prices, no currency columns, no bulk edit or import UI, no price history.
- Unit is the part only; tiered prices for resellers' shoppers are not designed.

## Platform notes

Reseller prices are channel-scoped prices on the reseller's store channel (the brief's "channel prices"); the layered result relies on the price-selection model. Load `commercetools-commerce-patterns` (pricing models, limited-time pricing) and confirm embedded versus standalone prices (affects facets, see `consumer-storefront/design-product-listing-page`). The floor is a business rule enforced server-side, not only in the portal.

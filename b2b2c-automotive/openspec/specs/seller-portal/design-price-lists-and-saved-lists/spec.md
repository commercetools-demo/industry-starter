<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

<!-- OUT-OF-SCOPE -->

# Price lists (contract price build-up) and saved lists

> **Out of scope (owner, 2026-10-12).** Wholesale buying from Malva is not built (Q-V01): contract price lists and saved lists exist only for that flow. No workstream implements this spec; `plans/verify-plan.mjs` skips it because of the marker line above. Kept for reference only.

## Purpose

A reseller must understand exactly how Malva arrives at its wholesale price and be able to re-order repeat baskets quickly.

Design source: `Malva Seller Portal.dc.html`, pages `pricing` and `lists`.

## Requirements

### Requirement: Itemised price build-up

The system SHALL show, for a selected part, each price layer in the order applied with label, source and amount: Malva list price, account contract discount, volume tier, core charge, and "Your net unit price".

#### Scenario: Example
- **GIVEN** a part listed at €94.50, a 28% account discount and quantity 10
- **WHEN** the build-up renders
- **THEN** it shows €94.50, −€26.46, −5% volume (−€3.40) and net €64.64

#### Scenario: Source is named
- **GIVEN** the contract discount line
- **WHEN** it renders
- **THEN** its source reads like "Hartmann 2026 H2 · customer group Distributor A"

### Requirement: Volume tiers

The system SHALL show tier cards (1–9 base, 10–49 −5%, 50–199 −9%, 200+ −13% in the design) with price and discount each, highlight the tier for the entered quantity and set the quantity when a tier card is pressed.

#### Scenario: Pick tier
- **GIVEN** the 50–199 card
- **WHEN** pressed
- **THEN** quantity becomes 50 and the net price updates

### Requirement: Search jump

The system SHALL open this page from the global search with an exact part number.

#### Scenario: No match
- **GIVEN** a part number not in the assortment
- **WHEN** Enter is pressed
- **THEN** the first part remains selected and a "no match" toast shows

### Requirement: Upcoming price lists (later phase)

The system SHALL show upcoming price lists with their effective date and the parts whose price changes (the "Review" target of the dashboard heads-up) with before and after.

#### Scenario: Review
- **GIVEN** a list effective 1 November
- **WHEN** Review is pressed
- **THEN** changed parts show old and new net prices

### Requirement: Core charges

The system SHALL show a returnable core charge only on parts that carry one, and show €0 or "Not applicable" otherwise.

#### Scenario: Alternator
- **GIVEN** a remanufactured alternator with a core charge
- **WHEN** the build-up renders
- **THEN** the core charge line shows its amount and the return rule

### Requirement: Saved lists

The system SHALL list saved lists with name, lines, owner, updated and shared-with, keep only part numbers and quantities, resolve prices only when a list becomes a cart, and offer "Add to cart" per list and "New list".

#### Scenario: Prices at cart
- **GIVEN** a list saved last month
- **WHEN** added to cart
- **THEN** lines are priced at today's contract prices

#### Scenario: Shared
- **GIVEN** a list shared with a branch
- **WHEN** a branch user opens it
- **THEN** they can add it to their cart but not edit unless permitted

## Gaps

- No tier chart, no price history, no export, no list editor.

## Platform notes

Contract prices through customer groups or business-unit prices and tiered prices; purchase lists as shopping lists scoped to the business unit. Load `commercetools-commerce-patterns` (B2B customer group pricing) and `commercetools-storefront` (purchase lists).

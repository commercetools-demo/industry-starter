<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

<!-- OUT-OF-SCOPE -->

# Wholesale quick order, cart and checkout (Shop from Malva)

> **Out of scope (owner, 2026-10-12).** Wholesale buying from Malva is not built (Q-V01): resellers pull parts from the master catalog into their product selection, so they already have them. No workstream implements this spec; `plans/verify-plan.mjs` skips it because of the marker line above. Kept for reference only.

## Purpose

Resellers buy stock from Malva in bulk, by part number, at contract prices, with purchase order numbers and payment terms. Speed and honesty matter: every line says what happened to it.

Design source: `Malva Seller Portal.dc.html`, pages `quick` and `cart`.

## Requirements

### Requirement: Paste or upload part numbers

The system SHALL accept one line per part as "PART-NUMBER, quantity" (separators comma, semicolon or tab) in a text area or CSV upload, offer "Load sample", and validate on demand.

#### Scenario: Validation
- **GIVEN** seven lines pasted
- **WHEN** Validate lines is pressed
- **THEN** a results table shows number, part, product, quantity, unit price, line total and result

### Requirement: Exact match, never a guess

The system SHALL match part numbers exactly against the reseller's assortment, merge duplicate codes, and echo unmatched values back without substituting.

#### Scenario: Typo
- **GIVEN** the line "MLV-TB-4O517, 6" (letter O)
- **WHEN** validated
- **THEN** it shows "Not added — Submitted value echoed back, not guessed" and no similar part is added

#### Scenario: Duplicate
- **GIVEN** MLV-OF-20233 on two lines (120 and 30)
- **WHEN** validated
- **THEN** one line of 150 shows "Merged — Duplicate lines combined to 150"

### Requirement: Stock adjustment is stated

The system SHALL cap a quantity at available stock and say so ("Added at 12 — Requested 20; only 12 in stock").

#### Scenario: Over stock
- **GIVEN** 20 requested and 12 in stock
- **WHEN** validated
- **THEN** the line shows 12 with a warning tint and the reason

### Requirement: Summary chips and totals

The system SHALL show counts ready, adjusted and not added, the total at the account's contract price, "Save as list", and "Add {n} lines to cart" which then reads "Added {n} lines to cart".

#### Scenario: Unit prices
- **GIVEN** a quantity reaching a volume tier
- **WHEN** validated
- **THEN** the unit price is the tier price for the line quantity

### Requirement: Cart with named savings

The system SHALL show cart lines with stepper, each line's contract price at its quantity, struck-through pre-promo total, a promo code field with state per code, and a summary naming each saving (product promotion, large-order discount, code, free freight), shipping, VAT and gross total.

#### Scenario: Free freight
- **GIVEN** a net total of at least €1,500 in a free-freight zone
- **WHEN** the summary renders
- **THEN** shipping reads "Free freight (cart ≥ €1,500)" at €0.00 and total savings include the avoided fee

#### Scenario: Stacking visible
- **GIVEN** a promotion, a large-order discount and a valid code
- **WHEN** the summary renders
- **THEN** each is its own line and a "Total savings" line sums them

### Requirement: Checkout needs a PO number

The system SHALL show ship-to address, payment terms, a purchase order field and the approval note ("Approval: not required under €10,000"), and keep Place order disabled until a PO number is entered, with the reason.

#### Scenario: Missing PO
- **GIVEN** no PO number
- **WHEN** the action renders
- **THEN** Place order is disabled with "add a PO number"

#### Scenario: Placed
- **GIVEN** a valid PO and an order under the approval threshold
- **WHEN** Place order is pressed
- **THEN** "Order MO-… placed. Confirmation emailed." shows and the order is created

#### Scenario: Over threshold
- **GIVEN** a total above an approval rule
- **WHEN** Place order is pressed
- **THEN** the order is created awaiting approval and the user is told which tier decides

## Gaps

- Design carts are static (three lines); no empty cart, no multi-cart, no address editor, no payment-terms selection, no credit check message, no CSV column mapping, no catalogue search to add lines.
- The "cart" page shown as a panel list; the final design should adopt table rows.

## Platform notes

All cart and order writes go through the as-associate chain for the signed-in business unit (see `commercetools-storefront` B2B cart and checkout and `commercetools-commerce-patterns` as-associate API). Approval rules are evaluated at order creation, not cart creation.

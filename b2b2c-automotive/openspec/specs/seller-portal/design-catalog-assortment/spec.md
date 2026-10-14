<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Catalog and assortment (Malva master to reseller storefront)

## Purpose

Malva owns the master catalog. A reseller chooses which master products its storefront sells, may exclude lines and may add its own products, so each storefront shows a different assortment. Authority flows down a chain, and a level can narrow or add but never widen what a parent withdrew.

Design source: `Malva Seller Portal.dc.html`, page `catalog`, tab "Assigned products" and the authority chain.

## Requirements

### Requirement: Authority chain is visible

The system SHALL show the chain Malva Global → Malva DACH → Reseller → Branches, mark the level the user edits, and state that each level can narrow or add, never widen what its parent withdrew.

#### Scenario: Edit level
- **GIVEN** a reseller admin
- **WHEN** the page renders
- **THEN** the reseller node is highlighted "You · edits this level" and branches read "Inherit from you"

### Requirement: Assigned products table

The system SHALL list master products with name, part number, list price or "Price pending", a state chip, a reason, and one row action, with filters All, Assigned, Available and Blocked upstream and a count "{n} of {total} master products assigned".

| State | Chip tone | Action |
| --- | --- | --- |
| Inherited | success | Withdraw here |
| Local addition | info | Withdraw here |
| Available | neutral | Assign |
| Withdrawn by you | warning | Reinstate |
| Pre-release | info | Assign |
| Blocked upstream | critical | "Can't re-add" (disabled) |

#### Scenario: Blocked upstream
- **GIVEN** a part withdrawn by Malva DACH for lack of type approval
- **WHEN** it appears in the list
- **THEN** its chip is Blocked upstream, the reason is shown, and its action is disabled and cannot be forced

#### Scenario: Withdrawing hides from branches
- **GIVEN** an inherited part
- **WHEN** the reseller withdraws it
- **THEN** the reason explains that branches lose it as well, and storefront listings no longer show it

#### Scenario: Pre-release part
- **GIVEN** a part configured but not priced
- **WHEN** it is listed
- **THEN** it reads "Price pending", never €0, and a storefront shows "price pending" if assigned

### Requirement: Local products

The system SHALL show reseller-added products with a "Local addition" chip, visible to the reseller's branches only.

#### Scenario: Other resellers
- **GIVEN** a local product
- **WHEN** another reseller views the master catalog
- **THEN** it is not visible

### Requirement: Assortment changes are safe

The system SHALL apply assortment changes only after confirmation when a change affects branches or open carts, and SHALL show the number of affected products.

#### Scenario: Bulk withdraw
- **GIVEN** a line of 40 products selected
- **WHEN** Withdraw is pressed
- **THEN** a confirmation names the count and open-cart impact before applying

## Layout

Chain card, then six tabs (Assigned products, Price overrides, Product info, Product discounts, Cart discounts, Discount priority), then table with minimum 820 px width, scrolling horizontally on narrow screens.

## Gaps

- No bulk selection, search, category filter or sort in the table; add (admin kit supports bulk-select bar).
- Brief says resellers can exclude lines; design works per product only. Add line (category or brand) level assign/exclude.
- No audit trail.

## Platform notes

Assortment maps to product selections assigned to the reseller's store; the chain maps to business-unit and store hierarchy with inherited selections. Load `commercetools-commerce-patterns` (catalog architecture, BU hierarchy). Confirm how "never widen" is enforced (selection assignment rules versus portal-only checks).

<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Brand partnership (guardrails Malva keeps)

> **Owner scope change (2026-10-12), still in scope but narrowed.** There is no MAP price floor (Q-T03: resellers may set any price above zero) and no territory blocking at checkout (Q-O03), and tailored text and images need no approval (Q-T06). The minimum-advertised-price rule, its Price floor KPI, the Territories KPI and requirement "Territories enforced at checkout" and the floor parts of "Rules enforced server-side" are therefore not built; the page keeps the local-fitment-claim review state and the pending-claims flags. The plan records the mapping in `plans/workstreams/W-*.md` (section "Owner scope changes").

## Purpose

Resellers run their own store and set their own retail prices, so margin is theirs; Malva keeps a short set of brand rules. This page makes those rules visible and shows what the reseller must fix. There is **no commission, tier or payout**: the Earnings page in the prototype is out of scope (decision of 2026-10-12), and "Earnings" is removed from the "With Malva" navigation group.

Design source: `Malva Seller Portal.dc.html`, page `partnership`.

## Requirements

### Requirement: Guardrails listed with state

The system SHALL list the rules Malva enforces, each with description and state: minimum advertised price, approved content only, authorised territories, mandatory fitment disclaimer.

#### Scenario: Rule text
- **GIVEN** the minimum advertised price rule
- **WHEN** it renders
- **THEN** it states the floor as a share of the Malva list price (88% in the prototype) and shows "Enforced"

### Requirement: KPI summary

The system SHALL show four indicators: Compliance, Price floor, Territories, Content review (pending count).

#### Scenario: Open flags
- **GIVEN** two open flags
- **WHEN** the page renders
- **THEN** Compliance shows its value with "2 open flags"

### Requirement: Flagged for you

The system SHALL list each violation or pending item with part, reason and a fix action that leads to the page where it is fixed.

#### Scenario: Price below floor
- **GIVEN** an override below the floor
- **WHEN** Fix price is pressed
- **THEN** the price overrides tab opens on that part (`seller-portal/design-price-overrides-and-margin`)

#### Scenario: Content pending review
- **GIVEN** a tailored description awaiting review
- **WHEN** the item renders
- **THEN** it says the master text shows meanwhile and links to product info (`seller-portal/design-product-info-tailoring`)

### Requirement: Territories enforced at checkout

The system SHALL block orders shipping outside authorised territories with a clear message and keep pickup possible.

#### Scenario: Outside territory
- **GIVEN** a shipping address in a non-authorised country
- **WHEN** the shopper checks out
- **THEN** shipping is refused for that address

### Requirement: Rules enforced server-side

The system SHALL enforce the price floor and territories on the server, so a portal bypass cannot publish a violating price or accept a violating order.

#### Scenario: Direct request
- **GIVEN** a price below the floor sent to the API directly
- **WHEN** it is received
- **THEN** it is rejected with the floor value

## Gaps

- Compliance score ("96%") has no defined calculation; define it or drop the number.
- No dispute path for a flag and no history of resolved flags.

## Platform notes

Floor and territory rules are business rules in the service layer, not commercetools features. Territory blocking can use shipping zones and cart validation (see `commercetools-commerce-patterns`).

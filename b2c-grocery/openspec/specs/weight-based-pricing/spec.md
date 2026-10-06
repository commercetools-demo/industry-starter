<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Prices for goods sold by weight or measure

## Purpose

Fresh categories are priced per kilogram but picked to an approximate weight, so the amount a shopper is charged cannot be final at checkout. Presenting a per-unit price without saying the total is provisional is the most common source of grocery billing disputes.

## Requirements

### Requirement: Prices for goods sold by weight or measure

The system SHALL present goods sold by weight or measure with a price per unit of measure and an explicitly provisional order total, until the picked quantity is confirmed by fulfillment.

#### Scenario: Per unit price shown
- **GIVEN** a product sold by weight
- **WHEN** the shopper views it in a list or on its detail page
- **THEN** the price per unit of measure is shown alongside the price of the sellable increment

#### Scenario: Total marked provisional
- **GIVEN** a cart containing at least one weight-variable line
- **WHEN** the shopper reaches checkout
- **THEN** the order total is presented as provisional, stating that the final amount depends on the picked weight

#### Scenario: Picked weight reconciled
- **GIVEN** a placed order with a weight-variable line
- **WHEN** fulfillment reports the actually picked weight
- **THEN** the order records the final quantity and amount, and the difference against the provisional amount is visible to the shopper

#### Scenario: Discrete increments only
- **GIVEN** a product sold only in fixed increments such as 500 g or 1 kg
- **WHEN** the shopper adds it to the cart
- **THEN** only those increments are selectable and the total is exact, not provisional

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Price per unit of measure on the product tile and PDP | `[CACHED]` | Derived from the priced increment; display concern, not a price type |
| Provisional-total notice in cart and checkout | `[STATIC]` | Static copy; shown whenever any line is weight-variable |
| Final picked-weight reconciliation on the order | `[MIDDLEWARE]` | Inbound from fulfillment; commercetools is not the record of truth |

## commercetools

**Entities:** `Product`, `ProductVariant`, `StandalonePrice`, `Cart`, `Order`, `Type`

**Verified API surface**

- (concept) Approach 1, variant-based discrete quantities: model each sellable increment (500 g, 1 kg, 6-pack) as a ProductVariant with its own price. Established among grocery customers, keeps everything inside native price selection — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-b2b-pricing/modeling-unit-based-pricing)
- (concept) Approach 2, smallest-unit modeling: price the smallest indivisible unit (one gram) as a Standalone Price, using HighPrecisionMoney when a single unit costs a fraction of a cent, and convert to the display unit in middleware or a custom field — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-b2b-pricing/high-precision-pricing)
- (concept) HighPrecisionMoney pairs preciseAmount with fractionDigits; preciseAmount is a 64-bit integer, so more decimal places means a smaller maximum whole-currency amount - use the smallest fractionDigits that the pricing needs — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-b2b-pricing/high-precision-pricing)

**Constraints that change the design**

- commercetools has no native unit-of-measure price type - money is stored as integers, so unit-based pricing is a modeling exercise and primarily a display concern — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-b2b-pricing/modeling-unit-based-pricing)
- The Cart's priceRoundingMode governs how a HighPrecisionMoney line price becomes payable; HalfEven minimizes cumulative rounding bias across many lines — [docs](https://docs.commercetools.com/api/carts-orders-overview)
- For weighed or measured goods the commercetools order is commonly a preliminary record - the definitive billed quantity is determined by the fulfillment or weighing system at shipment and flows back as the definitive order or invoice — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-b2b-pricing/modeling-unit-based-pricing)

**Modeling notes**

Choose per category, not per project: discrete increments belong to Approach 1 (variants), truly continuous quantities to Approach 2 (smallest unit + high precision + middleware conversion). State the hand-off to fulfillment explicitly to stakeholders up front - expecting commercetools to be the system of record for the exact weighed total is the mistake this capability exists to prevent.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Which fresh categories sell in fixed increments and which are genuinely continuous?
- Which system is the record of truth for the final billed weight, and how does it report back?

---

_Excluded for B2C: Contract price per unit of measure._

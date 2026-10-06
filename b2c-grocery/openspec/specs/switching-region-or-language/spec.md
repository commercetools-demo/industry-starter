<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Switching region or language

## Purpose

Locale is not a display setting. Currency and country are inputs to price selection and to which products are sellable at all, so a half-applied region switch produces a cart priced in one currency against a catalog from another — which fails at checkout, not at the switch.

## Requirements

### Requirement: Switching region or language

The storefront SHALL keep language, currency, price and product availability consistent with the buyer's selected region, so that no page mixes one region's prices with another's catalog.

#### Scenario: Region switched before a cart exists
- **GIVEN** a buyer with no cart
- **WHEN** the buyer changes region
- **THEN** language, currency, prices and the sellable catalog all reflect the new region

#### Scenario: Region switched with a cart
- **GIVEN** a cart already priced in the previous region's currency
- **WHEN** the buyer changes region
- **THEN** the currency mismatch is resolved explicitly rather than leaving a cart that cannot be checked out

#### Scenario: Product not sellable in the new region
- **GIVEN** a cart line whose product has no price in the new region
- **WHEN** the region changes
- **THEN** the buyer is told which lines cannot be carried over, rather than seeing them silently vanish or block checkout

## commercetools

**Entities:** `Cart`, `Price`, `StandalonePrice`, `Store`, `Channel`, `Product`

**Constraints that change the design**

- Price selection resolves on currency first, then validity dates, customer group, distribution channel and country, in that precedence order — so currency and country are selection inputs, not presentation — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/price-calculation/price-selection)
- A Cart's currency is fixed at creation. Changing region therefore means creating a new cart, not re-pricing the existing one — [docs](https://docs.commercetools.com/api/projects/carts)
- Price selection can resolve to no price at all (the lowest branch of the cascade), which is how a product becomes unsellable in a region rather than merely unpriced — [docs](https://docs.commercetools.com/api/pricing-and-discounts-overview)

**Modeling notes**

Because a cart's currency is immutable, "switch region" is really "create a new cart and decide what carries over". Decide that policy explicitly: silently dropping lines is the behavior buyers complain about, and blocking the switch is the behavior they abandon over.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- On a region switch with a populated cart: carry lines over where a price exists, or start empty?

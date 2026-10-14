<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Cart management

## Purpose

The cart is the last place a buyer can still change their mind cheaply. A total the storefront computed itself will eventually disagree with the total charged, and that disagreement is the single most damaging trust failure in commerce.

## Requirements

### Requirement: Cart management

The storefront SHALL let a buyer change the contents of their cart and see every total recalculated by the commerce engine before they commit to buying.

#### Scenario: Quantity changed
- **GIVEN** a cart with at least one line
- **WHEN** the buyer changes a line quantity or removes a line
- **THEN** the line total and the order summary are re-read from the cart, not recomputed client-side

#### Scenario: Discount code rejected
- **GIVEN** a buyer applying a discount code
- **WHEN** the code is invalid, expired or its predicate is not met
- **THEN** the buyer is told the code was not applied and the totals are unchanged

#### Scenario: Empty cart
- **GIVEN** a cart with no lines
- **WHEN** the buyer opens it
- **THEN** the empty state is shown with a path back into the catalog

## Pages

- [Cart with engine-calculated totals after every change](../cart-page/spec.md)

## commercetools

**Entities:** `Cart`, `LineItem`, `DiscountCode`, `CartDiscount`, `Type`

**Constraints that change the design**

- Every cart update returns a new cart version; the storefront must use the returned cart rather than patching its own copy, or it will show stale totals and hit version conflicts — [docs](https://docs.commercetools.com/api/projects/carts)
- There is no update action to set the Store on an existing Cart — it must be set at creation, via in-store cart creation or CartDraft.store — [docs](https://docs.commercetools.com/api/projects/carts)

**Modeling notes**

Treat the cart as server-owned state that the storefront renders, never as client state the storefront syncs. Because the Store cannot be set after creation, the buyer's commercial context has to be known before the first line is added.

## commercetools skills

Load `commercetools-storefront` before implementing this capability. Any task generated from this spec carries `[SKILL: commercetools-storefront]`.

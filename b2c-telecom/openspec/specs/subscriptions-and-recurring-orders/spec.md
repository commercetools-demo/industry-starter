<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Subscriptions and recurring orders

## Purpose

A recurring order is a standing commitment, and the commitment is what makes it valuable to both sides. If the only way to change one is to cancel it, every change is a churn risk; and because a recurring order spans months, whether its price is locked or re-evaluated is a decision the buyer is entitled to understand up front.

## Plan notes

**As built by workstream L.** "Schedule changed in place" is not built: changing cadence or quantity is a plan change (D-040); the monthly cadence is fixed by the policy `malva-monthly` (D-012). Charging each period is out of scope (D-059): only a dry-run sweep (`job:schedule-sweep`) exists. Creating an order with a recurring line creates the Recurring Order automatically (needs a customer on the cart). `paymentStrategy` is never set by the storefront (L finding: it blocks the order without a payment allocation); the hosted Checkout live proof (spike P4, P5) waits for OA-05.

## Requirements

### Requirement: Subscriptions and recurring orders

The storefront SHALL let a buyer set up a repeating order and afterwards change its schedule, quantities or payment details without canceling and rebuilding it.

#### Scenario: Recurring order created
- **GIVEN** a buyer with a cart they want repeated
- **WHEN** the buyer sets a cadence and confirms
- **THEN** a recurring order exists with that schedule and the buyer can see when the next order will be generated

#### Scenario: Schedule changed in place
- **GIVEN** an active recurring order
- **WHEN** the buyer changes the cadence or a quantity
- **THEN** the change applies from the next generated order and the recurring order is not recreated

#### Scenario: Catalog price moved
- **GIVEN** an active recurring order whose product price has since changed
- **WHEN** the next order is generated
- **THEN** whether the original or the new price applies follows the recurring order's configured price-selection behavior, and the buyer was told which applies

#### Scenario: Paused or canceled
- **GIVEN** an active recurring order
- **WHEN** the buyer pauses or cancels it
- **THEN** no further orders are generated and the buyer is told when the last one was

## Pages

- [Saved and requisition lists with bulk add to cart](../saved-lists/spec.md)

## commercetools

**Entities:** `RecurringOrder`, `RecurrencePolicy`, `Cart`, `LineItem`, `Order`, `Price`

**Verified API surface**

- (concept) A recurring line item references a RecurrencePolicy; price selection first looks for a recurrence-specific Price using the same cascade and falls back to the standard one-time Price if none matches — [docs](https://docs.commercetools.com/api/recurring-orders-overview)
- (concept) For a fixed, scheduled cadence use a Recurring Order; for an ad-hoc repeat of a past purchase replicate the Cart or Order instead — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/implement-b2b-purchase-flows/the-b2b-cart)

**Constraints that change the design**

- PriceSelectionMode on each recurring line item decides how later price changes affect an active recurring order: Fixed locks the price at creation, Dynamic re-evaluates it each time an order is generated. This is a billing-predictability versus price-currency trade-off, not an implementation detail — [docs](https://docs.commercetools.com/api/recurring-orders-overview)

**Modeling notes**

Fixed versus Dynamic price selection is the decision to make before building anything else here, and it should be surfaced to the buyer in words rather than left implicit. Do not model an ad-hoc reorder as a recurring order — replicating a cart or order is the right tool and avoids a schedule nobody wanted.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Fixed or Dynamic price selection — and is that a per-product or project-wide decision?

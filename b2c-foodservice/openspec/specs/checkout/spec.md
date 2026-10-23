<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Checkout

## Purpose

Checkout is the one irreversible step. Shipping cost and tax are not known until an address and a delivery method exist, so the total moves during the flow; a buyer who is charged an amount they were never shown disputes the order, and a payment authorized for a stale amount fails on capture.

## Requirements

### Requirement: Checkout

The storefront SHALL convert a cart into a placed order only after the buyer has seen the final amount, including shipping and tax, that will be charged for it.

#### Scenario: Address changes the total
- **GIVEN** a cart in checkout
- **WHEN** the buyer sets or changes the shipping address or the delivery method
- **THEN** shipping cost, tax and the available delivery options are re-read from the cart before the summary is shown again

#### Scenario: Totals moved after authorization
- **GIVEN** an authorized payment for a given amount
- **WHEN** the cart total changes before the order is created
- **THEN** the order is not placed against the stale authorization, and the buyer is asked to re-authorize the new amount

#### Scenario: Placement fails at the last moment
- **GIVEN** a submitted checkout
- **WHEN** order creation fails on a late validation such as a tax or discount change
- **THEN** the buyer is given a recoverable path rather than an opaque error, and no duplicate order is created on retry

## Pages

- [Checkout re-reading totals after each shipping change](../checkout-page/spec.md)
- [Order confirmation stating reference and true order state](../order-confirmation-page/spec.md)
- [Policy pages stating the effective date of the text shown](../policy-pages/spec.md)

## commercetools

**Entities:** `Cart`, `Order`, `ShippingMethod`, `Payment`, `TaxCategory`, `Zone`

**Verified API surface**

- (rest) GET shipping-methods matching-cart returns only the methods valid for the current cart given its address, contents and the project's Zones; setShippingMethod is rejected for a method that does not match the cart's conditions — [docs](https://docs.commercetools.com/api/projects/shippingMethods)
- (concept) When the cart total moves away from an authorized payment amount, the documented pattern is cancel-and-re-authorize: add a CancelAuthorization transaction, then create a new Payment with the new amountPlanned — [docs](https://docs.commercetools.com/learning-implement-checkout/custom-checkout/order-creation)

**Constraints that change the design**

- Setting the shipping address or the shipping method triggers automatic recalculation of shipping cost, taxes and available options — the storefront must re-read the cart after each, or it shows a mismatched summary — [docs](https://docs.commercetools.com/learning-implement-checkout/custom-checkout/shipping)
- Creating the Order snapshots all prices, discounts, taxes, shipping and payment onto the Order and moves the Cart to cartState Ordered, after which the Cart can no longer be modified — [docs](https://docs.commercetools.com/learning-implement-checkout/custom-checkout/order-creation)
- Order creation must be idempotent against retries; a late validation failure such as a changed tax rate or an invalidated discount is a normal outcome and needs a recovery path — [docs](https://docs.commercetools.com/learning-implement-checkout/custom-checkout/order-creation)

**Modeling notes**

Re-read the cart after every step that can move a total, and render the summary only from what the cart returned. Decide the cancel-and-re-authorize policy up front: it costs conversion but guarantees the authorization matches the charge, and the alternative is disputes.

## commercetools skills

Load `commercetools-checkout` before implementing this capability. Supporting: `commercetools-storefront`, `commercetools-commerce-patterns`. Any task generated from this spec carries `[SKILL: commercetools-checkout]`.

## Open questions

- On a total change after authorization: re-authorize, or hold the original amount and reconcile downstream?

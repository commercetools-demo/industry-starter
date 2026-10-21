<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Checkout page

## Purpose

Checkout is owned by the complete commercetools Checkout (full hosted checkout flow, `checkoutFlow`) connected to Stripe (D-039). The hosted flow collects address, shipping and payment and creates the order. The storefront owns what surrounds it: the hand-off from the cart, the shell, a read-only order summary with fulfilment clusters, and the return to the confirmation page. This spec does not invent behaviour the hosted flow cannot do; whatever a hosted step cannot show is stated here as not provided.

Design source: `CheckoutPage` in `pages-checkout.jsx` (visual reference for the shell and summary only; its three-step form is replaced by the hosted flow).

## Requirements

### Requirement: Hosted flow owns the steps

The system SHALL hand the shopper to the hosted commercetools Checkout for contact, address, shipping method and payment (Stripe), and SHALL NOT build storefront forms, step indicators or card entry for those steps. The storefront SHALL start the flow only for a cart with at least one line, passing the cart and the session's customer when signed in.

#### Scenario: Start checkout
- **GIVEN** a cart with lines
- **WHEN** the shopper presses Checkout on the cart page or drawer
- **THEN** the storefront opens the hosted Checkout for that cart, inside the storefront shell where the hosted flow allows embedding, otherwise on the hosted page

#### Scenario: Empty cart
- **GIVEN** an empty cart
- **WHEN** `/checkout` is opened
- **THEN** the shopper is redirected to the cart page

### Requirement: Storefront shell around the flow

The system SHALL keep a reduced header (wordmark, secure-checkout note, link back to the bag) and the standard footer legal links around the hosted flow, and SHALL NOT show the full navigation or the cart drawer there.

#### Scenario: Back to bag
- **GIVEN** the hosted flow is open
- **WHEN** the shopper follows "Back to bag"
- **THEN** the cart page opens with the cart unchanged

### Requirement: Order summary with fulfilment clusters

The system SHALL show a read-only order summary beside or above the hosted flow: item count, a scrollable (200px) list of lines grouped in the same clusters as the cart ("Collect at {store}", "Delivery", "Subscription"), each line with image, name, variant, quantity, chip and price, then Subtotal, Discount (teal, negative), Shipping, Tax (tax-exclusive, added) and Total. Totals come from the cart in commercetools, not from the storefront's arithmetic.

#### Scenario: Mixed bag summary
- **GIVEN** a US bag with collect and delivery lines
- **WHEN** the summary renders
- **THEN** both clusters show with their lines and chips, and the total equals the cart total

#### Scenario: Canada summary
- **GIVEN** the Canada market is active
- **WHEN** the summary renders
- **THEN** no Collect cluster appears and the tax line shows GST only

### Requirement: Fulfilment inside the hosted flow

The system SHALL treat collection and multiple shipping inside the hosted flow as an outcome of spike K-01: the storefront SHALL show the order summary clusters above either way, and SHALL NOT claim that the hosted flow offers a pickup-person field, an Express method or a delivery-slot picker (D-034: standard carrier only). If K-01 finds the hosted flow cannot represent collect lines, the fallback recorded by the spike applies and is stated in the tasks.

#### Scenario: Standard carrier only
- **GIVEN** a bag with delivery lines
- **WHEN** the hosted flow offers shipping methods
- **THEN** only the standard carrier method is offered

### Requirement: Failure and abandonment

The system SHALL leave the cart intact when the hosted flow is abandoned, cancelled or the payment fails, and SHALL return the shopper to the bag with a message saying the order was not placed.

#### Scenario: Payment declined
- **GIVEN** a payment is declined in the hosted flow
- **WHEN** the shopper returns to the storefront
- **THEN** the bag is untouched and no order exists

#### Scenario: Success return
- **GIVEN** payment succeeds and the order is created
- **WHEN** the hosted flow returns to the storefront
- **THEN** the cart is cleared and the confirmation page opens for that order

### Requirement: Dropped from VELA

The system SHALL NOT carry over the "Create a quote" button, the storefront-built Details, Fulfilment and Payment steps, or the in-page promo code field (promo codes live on the cart page).

#### Scenario: B2C
- **GIVEN** the Malva checkout
- **WHEN** it renders
- **THEN** the hosted Place order action is the only commit action

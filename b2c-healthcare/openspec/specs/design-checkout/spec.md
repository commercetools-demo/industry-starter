<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Checkout and order confirmation design

## Purpose

Checkout is one page of three stacked cards (delivery address, delivery speed, payment) beside a sticky order summary. The prototype collects card numbers in plain inputs and computes the total in the browser; both must change. The order-confirmation page that follows doubles as tracking and must not expose an order to anyone but its patient.

Design reference: `design/DESIGN.md`; source `design/source/app-rx.jsx` (`Checkout`, `Order`). Behavioral base: `checkout-page`, `checkout`, `order-confirmation-page`, `payment-methods`.

## Requirements

### Requirement: Single-page checkout layout

The system SHALL render `/checkout` for a signed-in patient with a page head "Checkout", a left column of three cards in the order Delivery address, Delivery speed, Payment, and a sticky (top 96px) Order summary on the right; under 900px the summary stacks below.

#### Scenario: Empty cart
- **GIVEN** an empty cart
- **WHEN** `/checkout` opens
- **THEN** it shows "Your cart is empty. Find a prescription" linking to `/prescriptions`

#### Scenario: Anonymous visitor
- **GIVEN** no session
- **WHEN** `/checkout` opens
- **THEN** the sign-in card shows "Sign in to check out." and returns to checkout afterwards

### Requirement: Delivery address

The system SHALL collect full name, street address, city, ZIP and phone, all required, and SHALL validate formats.

#### Scenario: Prefill
- **GIVEN** a patient with a saved default address (see `address-book`)
- **WHEN** the card renders
- **THEN** the fields are prefilled and editable; the name defaults to the account name

#### Scenario: Invalid input
- **GIVEN** a malformed ZIP or phone
- **WHEN** the patient submits
- **THEN** the field shows an inline error and focus moves to it (the prototype only checks `required`)

### Requirement: Delivery speed re-pricing

The system SHALL offer the delivery options the platform returns for the address, as radio cards with name and price, and SHALL recalculate totals when the choice changes.

#### Scenario: Options
- **GIVEN** an address
- **WHEN** the card renders
- **THEN** it shows "Standard · 1–2 days — FREE" selected by default and "Same-day · by 8 pm — $5.00"; the selected card has a 1.5px azure border

#### Scenario: Same-day not available
- **GIVEN** the cut-off has passed or the address is out of area
- **WHEN** options load
- **THEN** same-day is not offered (decision D8)

#### Scenario: Change
- **GIVEN** the patient selects Same-day
- **WHEN** the selection changes
- **THEN** the summary Delivery row shows $5.00 and Total includes it, from the recalculated cart

### Requirement: Payment through the payment widget

The system SHALL collect payment with the platform's payment widget and SHALL NOT render card number, expiry or CVC as storefront inputs.

#### Scenario: Payment card
- **GIVEN** the Payment card
- **WHEN** it renders
- **THEN** it hosts the payment component; no card data touches storefront code and no test card values are prefilled

#### Scenario: Declined payment
- **GIVEN** a declined payment
- **WHEN** the patient submits
- **THEN** the order is not placed, the cart is kept, and an inline message explains it

### Requirement: Place order

The system SHALL place the order from the server-held cart, once, and show confirmation.

#### Scenario: Summary
- **GIVEN** the order summary
- **WHEN** it renders
- **THEN** it lists each line (name, price), Delivery (FREE or fee), Total (navy 20px bold) and a full-width "Place order" button, with figures from the cart

#### Scenario: Double submit
- **GIVEN** the button is activated twice
- **WHEN** the second activation arrives
- **THEN** only one order is created and the button shows a busy disabled state

#### Scenario: Success
- **GIVEN** a valid form and authorized payment
- **WHEN** the order is placed
- **THEN** the cart is emptied and the patient is redirected to `/order/:id` with an order number issued by the platform

### Requirement: Order confirmation and tracking

The system SHALL show `/order/:id` as a single card with order summary and status timeline.

#### Scenario: Content
- **GIVEN** a placed order
- **WHEN** the page renders
- **THEN** it shows a green "Order placed" badge, H1 "Your medication is on its way.", rows Order, Items, Deliver to, Estimate ("Today by 8 pm" or "1–2 business days") and Total, a four-step timeline (Order received, Pharmacist review, Packed and shipped, Delivered; completed steps green) and buttons "My orders" and "Search another RX"

#### Scenario: Other patient's order
- **GIVEN** an order id belonging to another patient
- **WHEN** it is opened
- **THEN** the page shows "Order not found." and nothing else; the same message is shown for an id that does not exist

#### Scenario: Timeline follows real status
- **GIVEN** an order whose pharmacist review has completed
- **WHEN** the page renders
- **THEN** the timeline marks Order received and Pharmacist review done; the prototype's static first-step-only timeline is replaced by order/shipment state

## Components

| Component | Data source |
| --- | --- |
| Address card | middleware (address book) |
| Delivery speed card | middleware (shipping methods for the cart) |
| Payment card | payment widget |
| Order summary | middleware (cart totals) |
| Confirmation and timeline | middleware (order, state) |

## commercetools

Entities: `Cart` (`shippingAddress`, `shippingInfo`), `ShippingMethod`/`ZoneRate`, `Payment`, `Order`, `State`. Payment through commercetools Checkout (payment-only mode or full flow; see `commercetools-checkout`); order number from the platform's order number, not a client random ID (the prototype generates `ORD-` + random). Order retrieval is scoped to the customer.

## commercetools skills

Load `commercetools-checkout` and `commercetools-storefront` before implementing. Supporting: `commercetools-commerce-patterns`.

## Open questions

- D8: same-day cut-off, coverage and fee.
- Is a pharmacist review a platform `State` or an external step surfaced through order state?
- Insurance/payer cost share is not designed (see `payer-and-patient-cost-share`).

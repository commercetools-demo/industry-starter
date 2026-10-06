<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Order confirmation stating reference and true order state

## Purpose

This page is the buyer's receipt and the only artefact they will quote back when something goes wrong, so the reference has to be the order's real identifier and the state has to be the order's real state. An order that has been submitted into an approval flow is not yet a commitment to deliver; telling the buyer it is confirmed produces a purchase their own organization has not authorized and a delivery expectation nobody owns.

## Requirements

### Requirement: Order confirmation stating reference and true order state

The system SHALL present the placed order's own reference together with the order's actual state, so that an order still awaiting approval is described as awaiting approval and never as confirmed.

#### Scenario: Order placed
- **GIVEN** an order created without any approval requirement
- **WHEN** the confirmation page renders
- **THEN** the order reference, the captured totals and the next steps are shown from the order itself, not from the cart

#### Scenario: Placement outcome unknown
- **GIVEN** order placement that failed with a server error after the request was sent
- **WHEN** the buyer returns to the confirmation page
- **THEN** the order is looked up by the reference generated before submission and either the confirmation or a single retry path is shown, and no second order exists

#### Scenario: Revisited later
- **GIVEN** a buyer who reloads the confirmation page or returns to it from a bookmark
- **WHEN** the page renders
- **THEN** it renders from the stored order and does not depend on the cart or the session that placed it

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Confirmation message with order number | `[MIDDLEWARE]` | Returned from order submission response |
| Estimated delivery date | `[MIDDLEWARE]` | From order response |
| Order summary (items, address, payment, totals) | `[MIDDLEWARE]` | Snapshot from placed order |
| Download or print receipt | `[MIDDLEWARE]` | Generated PDF or order data |
| Track order link | `[MIDDLEWARE]` | Order plus fulfillment reference |
| Continue shopping and go to order history actions | `[STATIC]` | Navigation links |
| Support contact information | `[STATIC]` | CMS-managed |

## commercetools

**Entities:** `Order`, `Cart`, `ApprovalFlow`, `Payment`, `Message`, `Subscription`

**Verified API surface**

- (concept) Order creation emits an OrderCreated Message that a Subscription can consume to send the confirmation email and synchronize an ERP or OMS, keeping those out of the request that renders the page — [docs](https://docs.commercetools.com/learning-implement-checkout/custom-checkout/order-creation)
- (update-action) Shipment progress is recorded on the Order itself through the addDelivery and changeShipmentState update actions, so a track-order link can resolve from the Order before any external carrier data exists — [docs](https://docs.commercetools.com/api/projects/orders)

**Constraints that change the design**

- Creating an Order sets the source Cart's cartState to Ordered and snapshots all prices, discounts, taxes, shipping and payment details onto the Order - the confirmation must render the Order, because the Cart can no longer be modified and no longer represents the transaction — [docs](https://docs.commercetools.com/learning-implement-checkout/custom-checkout/order-creation)
- orderNumber is a user-defined identifier that must be unique within the Project and is immutable once set; generating it before placement makes retries idempotent, and a DuplicateField error on orderNumber means an Order with that number already exists — [docs](https://docs.commercetools.com/tutorials/standard-checkout-flow)
- A 5xx response from order creation does not mean the Order was not created - verify by querying the unique identifier supplied in the creation request, such as the orderNumber, before offering a retry — [docs](https://docs.commercetools.com/learning-implement-checkout/custom-checkout/order-creation)
- An ApprovalFlow is created automatically when a placed Order matches an active rule and starts in Pending; the platform sends no approval notifications, so pending state must be read from the flow's status and currentTierPendingApprovers or from ApprovalFlow Messages via a Subscription — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-approval-workflows/approval-flows-in-action)

**Modeling notes**

Render this page from a fresh read of the order by its reference so that a reload, a bookmark or a forwarded link all work. Keep the confirmation email and any downstream synchronization on the OrderCreated Message rather than in the placement request, so a slow mail service cannot fail a successful order. Where approval applies, read the approval flow for that order rather than inferring approval state from the order alone.

## commercetools skills

Load `commercetools-storefront` before implementing this capability. Supporting: `commercetools-connect`. Any task generated from this spec carries `[SKILL: commercetools-storefront]`.

## Open questions

- What generates the printable receipt, and is it the same document as the eventual invoice?
- Where does carrier tracking come from once a delivery exists, and is the tracking reference held on the order or in the fulfillment system?

---

_Excluded for B2C: Approval pending notice._

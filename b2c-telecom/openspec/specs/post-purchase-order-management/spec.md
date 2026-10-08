<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Post-purchase order management

## Purpose

"Where is my order" is the highest-volume support contact in commerce, and every one of those contacts is a self-service gap. Returns are the same problem with money attached: a buyer who cannot start one calls, and a return whose refund state is invisible generates a second call.

## Plan notes

**Cancel before service start and 30-day device return request only (D-040, D-062).** Built (V): cancel an order strictly before its stored service-start date (order state transition plus a cancellation record, recurring order cancelled) and request a device return within 30 days (a return record on the order). Not built: plan changes, mid-term amendments, partial cancellation, return processing (labels, receiving, restock, refund money movement), carrier integration and tracking events. Orders with lead time 0 (phone, wireless) cannot be cancelled online (D-062). "Shipment state visible", "Partial shipment", "Return started" and "Refund state visible" are built as read-only views of platform states; the demo script `demo:advance-order` writes them.

## Requirements

### Requirement: Post-purchase order management

The storefront SHALL let a buyer see the current fulfillment state of a placed order and start a return on it without contacting support.

#### Scenario: Shipment state visible
- **GIVEN** a placed order that has been dispatched
- **WHEN** the buyer opens the order
- **THEN** the shipment and its tracking reference are shown against the items in that shipment

#### Scenario: Partial shipment
- **GIVEN** an order dispatched in more than one parcel
- **WHEN** the buyer opens the order
- **THEN** each parcel and the items in it are distinguishable, rather than one aggregate status for the whole order

#### Scenario: Return started
- **GIVEN** a delivered order within its returns window
- **WHEN** the buyer starts a return for specific items
- **THEN** the return is recorded against those items with its own shipment and refund state

#### Scenario: Refund state visible
- **GIVEN** a return that has been received
- **WHEN** the buyer checks it
- **THEN** whether the refund has been made is shown, distinctly from whether the goods were received

## Pages

- [Order confirmation stating reference and true order state](../order-confirmation-page/spec.md)
- [Order history scoped to what the buyer may see](../order-history/spec.md)
- [Contact page that confirms only enquiries support has accepted](../contact-us/spec.md)
- [FAQ answers readable and indexable without being expanded](../faq/spec.md)

## commercetools

**Entities:** `Order`, `Delivery`, `Parcel`, `ReturnInfo`, `ReturnItem`, `Payment`

**Verified API surface**

- (concept) Fulfillment is modeled on the Order as Delivery, Parcel and TrackingData; parcels carry their own items, so partial shipments are representable — [docs](https://docs.commercetools.com/api/projects/orders)
- (update-action) Order addReturnInfo records a return; setReturnShipmentState and setReturnPaymentState track it. These actions exist on Order and Order Edit, not on Cart — [docs](https://docs.commercetools.com/api/projects/orders)

**Constraints that change the design**

- ReturnShipmentState transitions are Advised or Returned as entry states, then Returned to BackInStock or Unusable. ReturnPaymentState is NonRefundable or Initial as entry, then Initial to Refunded or NotRefunded — goods received and money refunded are deliberately separate states — [docs](https://docs.commercetools.com/api/projects/orders)
- A post-purchase change that affects the order total is an Order Edit, not a direct order update; a return that triggers a refund therefore touches both the return state and the settlement — [docs](https://docs.commercetools.com/api/carts-orders-overview)

**Modeling notes**

Do not collapse the two return state machines into one status field in the UI: "we have your goods" and "we have refunded you" are different facts to a buyer, and the API models them separately for that reason. Tracking data is usually owned by a carrier integration, so treat the storefront as a reader of it.

## commercetools skills

Load `commercetools-storefront` before implementing this capability. Supporting: `commercetools-connect`. Any task generated from this spec carries `[SKILL: commercetools-storefront]`.

## Open questions

- Who owns the returns process of record — commercetools, an OMS, or a third-party returns service?
- What is the returns window, and is it per category?

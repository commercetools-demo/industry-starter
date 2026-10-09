<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# An order staying open while its lines ship and backorder

## Purpose

A parts order is normally satisfied from several places over several days, and one line waiting on a factory is the ordinary case rather than an exception. An order model that closes on first shipment loses the buyer's view of what is still coming, which is precisely the information they need: a machine is down until the last line arrives, and knowing which line that is determines whether they source it elsewhere. Per-line state is also what makes the line actionable — a backordered line the buyer can cancel independently is a retained customer, while an order that must be canceled whole to escape one line is a lost one.

## Requirements

### Requirement: An order staying open while its lines ship and backorder

The system SHALL keep an order open while its lines are fulfilled progressively, holding a shipped, outstanding or backordered state and an expected date per line, so the order closes only once every line has reached a terminal state.

#### Scenario: Order stays open after first shipment
- **GIVEN** an order whose lines ship on different days
- **WHEN** the first shipment leaves
- **THEN** the order remains open, that line is marked shipped, and the remaining lines stay outstanding with their expected dates

#### Scenario: Backordered line identified
- **GIVEN** a line that cannot be supplied from any entitled location
- **WHEN** the order is fulfilled
- **THEN** that line is marked backordered with an expected date, distinguishable from a line merely awaiting despatch

#### Scenario: Line canceled independently
- **GIVEN** an order with one shipped line and one backordered line
- **WHEN** the buyer cancels the backordered line
- **THEN** only that line is canceled, the shipped line is unaffected, and the order total is adjusted accordingly

#### Scenario: Part shipped line
- **GIVEN** a line ordered in a quantity larger than was despatched
- **WHEN** the shipment is recorded
- **THEN** the line shows the quantity shipped against the quantity ordered and remains outstanding for the balance

#### Scenario: Availability notified
- **GIVEN** a backordered line whose stock becomes available
- **WHEN** availability is reported
- **THEN** the buyer is notified for that line, rather than having to re-check the order

#### Scenario: Expected date revised
- **GIVEN** an outstanding line whose expected date has moved
- **WHEN** the revision arrives
- **THEN** the line shows the revised date and that it changed, rather than silently replacing the original

#### Scenario: Order closes once
- **GIVEN** an order whose last outstanding line is either shipped or canceled
- **WHEN** that line reaches its terminal state
- **THEN** the order closes, and it does not close while any line is still outstanding

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Fulfillment state per line | `[MIDDLEWARE]` | Shipped, outstanding or backordered, not one order-level status |
| Quantity shipped against quantity ordered per line | `[MIDDLEWARE]` | A line can be part-shipped too |
| Expected date per outstanding line | `[MIDDLEWARE]` | Inbound from fulfillment; revised rather than fixed |
| Tracking per shipment | `[MIDDLEWARE]` | Several shipments per order, each with its own consignment |
| Cancel or amend one outstanding line | `[MIDDLEWARE]` | Without touching lines already shipped |
| Notification when a backordered line becomes available | `[MIDDLEWARE]` | The event the buyer is actually waiting for |
| Order closes when every line is terminal | `[MIDDLEWARE]` | Shipped, canceled or written off — not before |

## commercetools

**Entities:** `Order`, `Delivery`, `Parcel`, `TrackingData`, `LineItem`, `ReturnInfo`, `State`, `Subscription`, `Type`

**Verified API surface**

- (concept) An Order carries Delivery records, each with DeliveryItems and Parcels holding TrackingData, which is how several despatches against one order are represented rather than one shipment per order — [docs](https://docs.commercetools.com/api/projects/orders)
- (concept) A DeliveryItem references the Line Item and quantity in that delivery, so a line despatched in two parts is expressed as two DeliveryItems rather than as a line that is either shipped or not — [docs](https://docs.commercetools.com/api/projects/orders)
- (concept) States manage a resource's lifecycle with the application defining the States and their allowed transitions, so the rule that an order closes only when every line is terminal is expressed as a project-defined transition guard — [docs](https://docs.commercetools.com/learning-model-your-business-structure/state-machines/state-machines-page)
- (concept) InventoryEntry carries restockableInDays and expectedDelivery as informational fields supporting the display of estimated restock times and automated replenishment workflows, which is where a backordered line's expected date originates — [docs](https://docs.commercetools.com/learning-model-your-product-catalog/inventory-modeling/inventory-management)
- (concept) Subscriptions send notifications when a resource is modified and are used to trigger asynchronous processes such as charging a card after an order has shipped, which is how per-line shipment and availability events reach the buyer — [docs](https://docs.commercetools.com/api/projects/subscriptions)

**Constraints that change the design**

- The Order shipmentState is a single order-level value, so a per-line shipped, outstanding or backordered state is a Custom Field on the Line Item and the order-level value is derived from those rather than being the source of truth — [docs](https://docs.commercetools.com/api/projects/orders)
- Canceling one line of a placed order is a financial change and therefore an Order Edit, and applying an Order Edit reprices all Line Items from current Embedded or Standalone Prices and removes lines whose price no longer resolves — [docs](https://docs.commercetools.com/api/projects/order-edits)

**Modeling notes**

The platform gives you order-level shipmentState and line-level Delivery Items, and this capability needs the state at line level — so hold it as a Custom Field per line and derive the order-level value from it rather than the other way round. Deriving it the wrong way round is the common mistake and it produces an order that reports Shipped while two lines are still on backorder. Model despatches as Deliveries with DeliveryItems, which handles the part-shipped line for free. The expensive part is canceling one line: that is a financial change, so it is an Order Edit, and an Order Edit reprices every remaining line from current prices and drops lines whose price no longer resolves — on an order placed weeks ago against prices that have since moved, canceling one backordered line can quietly re-price the rest. Always preview the edit, compare the untouched lines' totals, and refuse to apply it if anything moved that the buyer did not ask to move. Guard the close transition explicitly rather than closing on the last Delivery, since a canceled or written-off line is terminal without ever being despatched.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-connect`, `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Which system owns the expected date for an outstanding line, and how often is it revised?
- How long may a line remain backordered before it is written off, and who decides?
- Is an order invoiced per shipment or once on completion?
- May a buyer substitute a backordered line for an available alternative in place?

---

_Excluded for B2B: Expected date revised by the seller._

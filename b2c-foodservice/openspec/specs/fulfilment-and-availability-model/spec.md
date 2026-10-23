<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Fulfilment and availability model

## Purpose

Malva Coffee sells in the United States and Canada, online for standard-carrier delivery, for collection in one of six New York City stores (US market only), and by subscription. This spec states how those three are represented in commercetools so the design specs (`design-product-detail-page`, `design-cart-page`, `design-checkout-page`, `design-account-area`) have one data model behind them. In-store selling is out of scope; stores appear here only as collection points and stock holders.

## Requirements

### Requirement: Stores are supply channels

The system SHALL represent each collection store as a commercetools channel with role `InventorySupply`, a key (`mcf-store-<slug>`), a localized name, an invented New York City address, geo location, opening hours and phone held in channel custom fields. There are exactly six, all in New York City (D-035), and all serve the US market. Only these channels appear in the store picker.

#### Scenario: Store list
- **GIVEN** channels with and without `InventorySupply`
- **WHEN** the store picker loads
- **THEN** only the six `InventorySupply` channels appear, nearest first

#### Scenario: Canada has no collection
- **GIVEN** the Canada market is active
- **WHEN** a page would show the store picker, a Collect option or a collection filter
- **THEN** it is hidden or replaced by a note that collection is available in the US market only, and the cart API rejects a collect line

### Requirement: Availability per store

The system SHALL take collection availability from inventory entries on the store's supply channel, and delivery availability from the entry without a channel (the online warehouse). A variant is collectable at a store only when that store's entry has available quantity greater than zero; low stock is a configured threshold.

#### Scenario: Collect at an empty store
- **GIVEN** a variant with stock online but none at the chosen store
- **WHEN** the shopper selects Collect
- **THEN** it is shown unavailable for collection and still available for delivery

### Requirement: Fulfilment per line

The system SHALL record each cart line's fulfilment as one of `collect`, `delivery` or `subscribe`: collect lines carry the store as `supplyChannel`; subscribe lines carry `recurrenceInfo`; delivery lines carry neither. A line custom field `fulfilment` mirrors the choice so the UI and reports read one value.

#### Scenario: Collect line
- **GIVEN** a shopper reserves a capsule box for collection at a store
- **WHEN** the line is added
- **THEN** the line has the store channel as `supplyChannel` and `fulfilment = collect`

### Requirement: Mixed bags

The system SHALL allow one bag to hold collect, delivery and subscribe lines (D-033; "no mixed bags" is not an option), and SHALL place them as one order using commercetools multiple shipping (`shippingMode: Multiple`) with one shipping method per fulfilment cluster (a "Collect in store" method with the store as the target address, and the standard-carrier method for delivery lines). The mechanism inside the complete hosted Checkout (D-039) and the fallback if it cannot represent this (recorded in `plans/DECISIONS.md` when chosen) are decided by workstream K (spike K-01), never by dropping mixed bags.

The cart page, cart drawer, checkout summary, confirmation and account orders SHALL show each line clearly marked inside its fulfilment cluster ("Collect at {store}", "Delivery", "Subscription") using the line's `fulfilment` field, as specified in `design-cart-page` and `design-cart-drawer`.

#### Scenario: Lines are marked by cluster
- **GIVEN** a bag with a machine for delivery, capsules for collection and a subscribed coffee
- **WHEN** the cart, drawer or order summary renders
- **THEN** each line appears in exactly one cluster whose heading and per-line chip match its `fulfilment` value

#### Scenario: Mixed order
- **GIVEN** a bag with a machine to ship and capsules to collect
- **WHEN** the shopper pays
- **THEN** one payment succeeds and the order shows both clusters, or two linked orders exist under the documented fallback

### Requirement: Order states for collection

The system SHALL model collection progress with order states `ordered`, `preparing`, `ready-for-collection` and `collected` (state keys seeded and listed in `CONTRACT_KEYS`), and the order page SHALL read the state to draw the tracker of `design-order-confirmation-page`.

#### Scenario: Ready
- **GIVEN** a store marks an order ready
- **WHEN** the shopper opens the order
- **THEN** the tracker shows Ready and the collection block shows the store and hours

### Requirement: Subscriptions

The system SHALL offer subscribe only where a variant has a recurring price for a recurrence policy, create one recurring order per subscribe line after the order is placed, and manage pause, resume, cancel (`canceled`), skip and interval change through the recurring order. A failure to create the recurring order never rolls back the paid order.

#### Scenario: Recurring order creation fails
- **GIVEN** an order with a subscribe line was placed
- **WHEN** recurring order creation fails
- **THEN** the order stays, the failure is logged with the order id, and the account shows the line as "subscription pending"

### Requirement: Shipping by market

The system SHALL offer the single standard-carrier shipping method (D-034; no Express, no timed slots) for the shopper's country and currency, with a free-shipping threshold per market (US in USD, Canada in CAD) read from shipping rate tiers, not from front-end constants.

#### Scenario: Threshold per market
- **GIVEN** different thresholds for US and Canada
- **WHEN** the cart page renders in each market
- **THEN** the progress message uses that market's threshold and currency

### Requirement: Tax by market

The system SHALL use the platform tax mode with tax categories for coffee and food (US 0%, Canada 0% zero-rated) and for machines and accessories (US 8% with NY 8.875%, Canada 5% GST), all as defaults accepted in D-036. Prices are tax-exclusive in both the US and Canada and tax is added and shown as such. Provincial tax (HST and PST) is not modelled in Canada and is noted for an accountant. Country-level fallback rates apply so an address without a state rate still resolves (`changeCountryTaxRateFallbackEnabled`).

#### Scenario: US address without state rate
- **GIVEN** a US shipping address whose state has no rate
- **WHEN** the cart is priced
- **THEN** the country rate is applied and the cart has a tax portion

#### Scenario: Canadian address
- **GIVEN** a Canadian shipping address in any province
- **WHEN** the cart is priced
- **THEN** a machine carries 5% GST, food carries 0%, and no provincial tax is added

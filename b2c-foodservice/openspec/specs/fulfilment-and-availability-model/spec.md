<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Fulfilment and availability model

## Purpose

Malva Coffee sells online for delivery, for collection in a store, and by subscription. This spec states how those three are represented in commercetools so the design specs (`design-product-detail-page`, `design-cart-page`, `design-checkout-page`, `design-account-area`) have one data model behind them. In-store selling is out of scope; stores appear here only as collection points and stock holders.

## Requirements

### Requirement: Stores are supply channels

The system SHALL represent each collection store as a commercetools channel with role `InventorySupply`, a key (`mcf-store-<city>`), a localized name, an address, geo location, opening hours and phone held in channel custom fields, and the country it serves. Only these channels appear in the store picker.

#### Scenario: Store list
- **GIVEN** channels with and without `InventorySupply`
- **WHEN** the store picker loads
- **THEN** only `InventorySupply` channels appear, nearest first

### Requirement: Availability per store

The system SHALL take collection availability from inventory entries on the store's supply channel, and shipping availability from the entry without a channel (the online warehouse). A variant is collectable at a store only when that store's entry has available quantity greater than zero; low stock is a configured threshold.

#### Scenario: Collect at an empty store
- **GIVEN** a variant with stock online but none at the chosen store
- **WHEN** the shopper selects Collect
- **THEN** it is shown unavailable for collection and still available to ship

### Requirement: Fulfilment per line

The system SHALL record each cart line's fulfilment as one of `collect`, `ship` or `subscribe`: collect lines carry the store as `supplyChannel`; subscribe lines carry `recurrenceInfo`; ship lines carry neither. A line custom field `fulfilment` mirrors the choice so the UI and reports read one value.

#### Scenario: Collect line
- **GIVEN** a shopper reserves a capsule box for collection at a store
- **WHEN** the line is added
- **THEN** the line has the store channel as `supplyChannel` and `fulfilment = collect`

### Requirement: Mixed bags

The system SHALL allow one bag to hold collect, ship and subscribe lines, and SHALL place them as one order using commercetools multiple shipping (`shippingMode: Multiple`) with one shipping method per fulfilment group (a "Collect in store" method with the store as the target address, and delivery methods for shipped lines). Whether the hosted Checkout supports this is verified in workstream K (spike K-01); if it does not, the fallback (recorded in `plans/DECISIONS.md` when chosen) is one order per fulfilment group, paid in sequence.

#### Scenario: Mixed order
- **GIVEN** a bag with a machine to ship and capsules to collect
- **WHEN** the shopper pays
- **THEN** one payment succeeds and the order shows both groups, or two linked orders exist under the documented fallback

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

The system SHALL offer shipping methods only for the shopper's country and currency, with a free-shipping threshold per market read from shipping rate tiers, not from front-end constants.

#### Scenario: Threshold per market
- **GIVEN** different thresholds for US, DE and GB
- **WHEN** the cart page renders in each market
- **THEN** the progress message uses that market's threshold and currency

### Requirement: Tax by market

The system SHALL use the platform tax mode with tax categories for coffee and food (reduced where the market has it) and for machines and accessories (standard), tax-inclusive prices in DE and GB and tax-exclusive prices in the US, and country-level fallback rates so a US address without a state rate still resolves (`changeCountryTaxRateFallbackEnabled`).

#### Scenario: US address without state rate
- **GIVEN** a US shipping address whose state has no rate
- **WHEN** the cart is priced
- **THEN** the country rate is applied and the cart has a tax portion

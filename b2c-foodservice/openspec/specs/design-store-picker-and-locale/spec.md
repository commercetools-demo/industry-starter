<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Collection-store picker and locale chooser

## Purpose

Two global choices change what every page shows: which of the six New York City stores the shopper collects from (live availability, US market only) and which market (United States or Canada) applies (currency, prices, copy). Both are modal chrome reachable from the header on every page.

Design source: `StorePicker` in `components.jsx`; `LocaleChooser` in `nav-extras.jsx`.

## Requirements

### Requirement: Store picker

The system SHALL open a centred modal titled "Choose your store" with a location search field, then a list of the six NYC stores nearest first. The store picker and every entry point to it (header pill, product page, cart cluster, account) SHALL be hidden in the Canada market, where collection is not offered (D-035). Each row shows a radio, name, address with distance, today's opening hours and, when opened from a product, that item's availability at the store (In stock, Low stock, Unavailable for this item). Selecting a row sets the store, closes the modal and persists the choice.

#### Scenario: Opened from a product
- **GIVEN** the picker is opened from a product page
- **WHEN** it renders
- **THEN** each store row carries a coloured availability line for that product

#### Scenario: Opened from the header
- **GIVEN** the picker is opened from the header
- **WHEN** it renders
- **THEN** rows show address and hours only

#### Scenario: Canada market
- **GIVEN** the Canada market is active
- **WHEN** any page renders
- **THEN** no store picker entry point is shown and a note, where collection would appear, says collection is available in the US market only

#### Scenario: Persistence
- **GIVEN** a shopper chose a store
- **WHEN** they return on a later visit
- **THEN** the same store is preselected

### Requirement: Store search

The system SHALL let the shopper search by ZIP code or neighbourhood and re-sort the list by distance from the result. The VELA prototype shows the field as static text; it SHALL be functional.

#### Scenario: No match
- **GIVEN** a search with no store within range
- **WHEN** results return
- **THEN** the picker says so and offers delivery instead

### Requirement: Locale chooser

The system SHALL open a right drawer headed by the current market and currency, a one-line statement of billing currency, and a market list with exactly two entries: United States (en-US, USD) and Canada (en-CA, CAD, English only), with a check on the current one. There is no language select because each market has one language (D-030; French is not built). Picking a market sets country, currency and locale together.

#### Scenario: Market change
- **GIVEN** the shopper picks Canada while in the US market
- **WHEN** the choice applies
- **THEN** every price re-renders in CAD, the locale is en-CA, the header pill updates and the store picker entry points disappear

#### Scenario: Only the offered markets
- **GIVEN** Malva sells in the US and Canada
- **WHEN** the chooser renders
- **THEN** it lists only those two; VELA's six regions are not carried over

### Requirement: Money formatting

The system SHALL format money from integer minor units with two decimals in the active locale (for example $4.90 in en-US and CA$4.90 in en-CA), and SHALL NOT use the prototype's whole-number rounding.

#### Scenario: Pod sleeve price
- **GIVEN** a sleeve of capsules priced 4.90
- **WHEN** it renders
- **THEN** it shows two decimals, not 5

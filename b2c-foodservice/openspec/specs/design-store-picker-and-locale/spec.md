<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Collection-store picker and locale chooser

## Purpose

Two global choices change what every page shows: which café or store the shopper collects from (live availability) and which country, language and currency apply (prices, copy). Both are modal chrome reachable from the header on every page.

Design source: `StorePicker` in `components.jsx`; `LocaleChooser` in `nav-extras.jsx`.

## Requirements

### Requirement: Store picker

The system SHALL open a centred modal titled "Choose your store" with a location search field, then a list of stores nearest first. Each row shows a radio, name, address with distance, today's opening hours and, when opened from a product, that item's availability at the store (In stock, Low stock, Unavailable for this item). Selecting a row sets the store, closes the modal and persists the choice.

#### Scenario: Opened from a product
- **GIVEN** the picker is opened from a product page
- **WHEN** it renders
- **THEN** each store row carries a coloured availability line for that product

#### Scenario: Opened from the header
- **GIVEN** the picker is opened from the header
- **WHEN** it renders
- **THEN** rows show address and hours only

#### Scenario: Persistence
- **GIVEN** a shopper chose a store
- **WHEN** they return on a later visit
- **THEN** the same store is preselected

### Requirement: Store search

The system SHALL let the shopper search by postcode or town and re-sort the list by distance from the result. The VELA prototype shows the field as static text; it SHALL be functional.

#### Scenario: No match
- **GIVEN** a search with no store within range
- **WHEN** results return
- **THEN** the picker says so and offers shipping instead

### Requirement: Locale chooser

The system SHALL open a right drawer headed by the current country and currency, a one-line statement of billing currency, a language select limited to that country's languages, and a "Choose your location" accordion by region (one open at a time) listing countries with their currency and a check on the current one. Picking a country sets currency and its first language; changing language alone keeps the country.

#### Scenario: Country change
- **GIVEN** the shopper picks another country
- **WHEN** the choice applies
- **THEN** every price re-renders in that currency and the header pill updates

#### Scenario: Only the offered locales
- **GIVEN** Malva sells in a defined set of countries
- **WHEN** the chooser renders
- **THEN** it lists only those; VELA's six regions are a placeholder (`design.md` Q3)

### Requirement: Money formatting

The system SHALL format money from integer minor units with two decimals in the active locale (for example 4,90 € or £4.90), and SHALL NOT use the prototype's whole-number rounding.

#### Scenario: Pod sleeve price
- **GIVEN** a sleeve of capsules priced 4.90
- **WHEN** it renders
- **THEN** it shows two decimals, not 5

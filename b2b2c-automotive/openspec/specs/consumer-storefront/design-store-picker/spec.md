<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Store picker (branch and pickup locator)

## Purpose

A reseller can have several branches. The shopper picks the branch that sets stock, pickup promise and, where the reseller prices by branch, price. The picker is a modal with a list and a map.

Design source: `Reseller Storefront.dc.html`, picker overlay (`open`, `stores`).

## Requirements

### Requirement: Choose a store from list or map

The system SHALL show a modal "Choose your store" with a search by postal code or city, a "Use my location" button, a list sorted by distance and a map with a pin per store, kept in sync.

#### Scenario: Focus syncs
- **GIVEN** the modal open
- **WHEN** the shopper selects a list row or a pin
- **THEN** both highlight, and only the focused store shows "Shop at this store"

#### Scenario: Choosing
- **GIVEN** a focused store
- **WHEN** "Shop at this store" is pressed
- **THEN** the modal closes, the header chip updates, and stock, pickup promise and prices on the page refresh

### Requirement: Each row states pickup facts

The system SHALL show per store: name, distance, address, hours state ("Open until 8 pm" or "Closed · opens 8 am") and pickup option ("Pickup today", "Pickup tomorrow", "Ship to store").

#### Scenario: Closed store
- **GIVEN** a store currently closed
- **WHEN** the row renders
- **THEN** the hours line says when it opens and pickup reflects the next opening

### Requirement: Location permission is optional

The system SHALL work without location access by searching postal code or city and never block the page on a permission prompt.

#### Scenario: Permission denied
- **GIVEN** the shopper refuses location
- **WHEN** the refusal is received
- **THEN** a message suggests entering a postal code and the list stays usable

### Requirement: Single-branch resellers skip the picker

The system SHALL hide the store chip and picker for a reseller with one store.

#### Scenario: One store
- **GIVEN** a reseller with one store
- **WHEN** any page renders
- **THEN** the header shows no "Your store" control and pickup text uses that store

### Requirement: Keyboard and screen reader use

The system SHALL trap focus in the modal, close on Escape and expose the list as the primary control, with the map as an enhancement.

#### Scenario: Escape
- **GIVEN** the modal open
- **WHEN** Escape is pressed
- **THEN** it closes and focus returns to the store chip

## Layout

Dialog up to 1100 × 680 px, two columns (list 300 px minimum, map), stacking on narrow screens. Open by default on a first visit in the design; recommended: open only when no store is chosen and more than one exists.

## Gaps and decisions

- The mock lists stores of different businesses (Northline, Lakeshore, Harbour, Maple Ridge, Capital) under one brand "Autoline". The brief says each reseller owns its domain and brand. Decision: the picker lists branches of the reseller that owns the domain. A cross-reseller locator, if wanted, is a separate Malva-level site (open question).
- Map is a placeholder; a map provider must be chosen.

## Platform notes

Branches map to stores (or channels) with distinct inventory and, optionally, prices. Choose between store and channel modelling with `commercetools-storefront` (BOPIS) and `commercetools-commerce-patterns`.

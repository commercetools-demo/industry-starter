<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Vehicle finder and "My garage"

## Purpose

Vehicle-first browsing is the core promise: a shopper picks a vehicle by plate, VIN or make/model/year before seeing parts, and only parts that fit are shown. A wrong fitment is a returned part and a lost customer, so the vehicle context must be explicit, persistent and correctable.

Design source: home finder card (`vehicleFields`), PLP "My garage" bar and "Fits my vehicle" filter, PDP fitment banner and "Compatible vehicles". Existing component study: `design-systems/automotive/components/car-lookup.html`.

## Requirements

### Requirement: Three ways to identify a vehicle

The system SHALL let a shopper identify a vehicle by registration plate (with country), by VIN, or by choosing year, make, model and engine in dependent selectors.

#### Scenario: Plate lookup resolves one vehicle
- **GIVEN** a plate that maps to one vehicle
- **WHEN** the shopper submits it
- **THEN** the resolved make, model, year and engine are shown for confirmation before being saved

#### Scenario: Plate matches several engines
- **GIVEN** a plate whose record lacks the engine
- **WHEN** the lookup returns
- **THEN** the shopper must pick the engine before parts are filtered

#### Scenario: Lookup fails
- **GIVEN** an unknown plate or malformed VIN
- **WHEN** it is submitted
- **THEN** the field states the problem in plain words and offers the make/model/year route, and nothing is saved

### Requirement: Garage persists across sessions

The system SHALL keep the chosen vehicles in a garage, anonymous shoppers in a cookie-scoped store and signed-in shoppers on their account, merging on sign-in, with one vehicle marked active.

#### Scenario: Merge at sign-in
- **GIVEN** an anonymous garage with one vehicle and an account garage with two
- **WHEN** the shopper signs in
- **THEN** the garage shows three vehicles without duplicates and the previously active vehicle stays active

### Requirement: Fitment filters what is offered

The system SHALL, once a vehicle is active, show only parts that fit it by default, with a "Fits my vehicle" filter that can be turned off to see everything, and SHALL label each part's fit state.

#### Scenario: Default is fit-only
- **GIVEN** an active vehicle
- **WHEN** a listing renders
- **THEN** the filter is on and every card shows "✓ Fits your vehicle"

#### Scenario: Turning the filter off
- **GIVEN** the filter turned off
- **WHEN** the listing renders
- **THEN** non-fitting parts appear with "✕ Does not fit" and their Add to cart is replaced by "View fitting alternatives"

#### Scenario: No vehicle yet
- **GIVEN** no active vehicle
- **WHEN** a listing or product renders
- **THEN** cards show "Select your vehicle to check fit" rather than a fit claim

### Requirement: Always correctable

The system SHALL show the active vehicle on listings and product pages with a Change vehicle control.

#### Scenario: Change on the product page
- **GIVEN** a product page with a fit result
- **WHEN** the shopper changes vehicle
- **THEN** the banner updates in place without losing the quantity entered

## Components

Selector row (4 dependent selects, 44 px), plate field with country, VIN field, "Verify fitment" pill/primary button, garage chip (`--color-success-50` fill, "2019 Honda Civic · 2.0L"), Change link (Archivo), fit badge (success or danger tint with glyph).

## Theming hooks

Primary button and chip border follow the brand colour. Fit badge colours are locked.

## Gaps and decisions

- Design shows non-fitting parts by default on the listing with the filter unchecked. The brief says only fitting parts are shown. Decision here: default on once a vehicle exists. Confirm with the owner.
- No design for multiple vehicles, plate lookup, VIN entry or errors. Needed.
- Fitment data (vehicle compatibility) belongs to Malva's master catalog. Resellers cannot edit it (see `seller-portal/design-product-info-tailoring`).

## Platform notes

Compatibility is modelled as product data (attributes or a lookup keyed by vehicle ID), not as free text. Open question: external vehicle database for plate and VIN decoding versus an in-house table. Load `commercetools-storefront` and `commercetools-platform` before choosing, and keep search facets flat (nested attributes are not searchable).

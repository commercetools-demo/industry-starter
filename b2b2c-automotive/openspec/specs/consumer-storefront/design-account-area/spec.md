<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Account area (shopper)

## Purpose

Signed-in shoppers need their orders, garage, addresses and returns in one place. **This area is not in the supplied designs** (the storefront only has a "Sign in" link). This spec sets the requirements and layout so the design can be produced in the same visual system.

## Requirements

### Requirement: Sign in, register, reset

The system SHALL provide sign in, registration and password reset with messages that do not reveal whether an email exists, and SHALL bind each shopper account to the reseller store where it was created.

#### Scenario: Account bound to a reseller
- **GIVEN** a shopper registered on reseller A's domain
- **WHEN** they sign in on reseller B's domain with the same email
- **THEN** sign-in is refused with the generic message, because shoppers belong to one reseller

#### Scenario: Anonymous cart and garage merge
- **GIVEN** an anonymous cart and garage
- **WHEN** the shopper signs in
- **THEN** both merge into the account without duplicates

### Requirement: Account home

The system SHALL show greeting, active vehicle, latest order status, quick links and a pickup-ready notice if any.

#### Scenario: Order ready
- **GIVEN** an order ready for pickup
- **WHEN** the account home renders
- **THEN** a top notice shows the store, hours and order number

### Requirement: Orders and returns

The system SHALL list orders with status, show detail with parts, delivery or pickup information and invoice download, and allow a return request within the reseller's window.

#### Scenario: Return request
- **GIVEN** a delivered order inside the return window
- **WHEN** the shopper requests a return for one line
- **THEN** a return is recorded for that line with reason, and the reseller sees it in `seller-portal/design-returns-and-reviews`

### Requirement: Garage

The system SHALL let the shopper add, remove, rename and set active vehicles (see `consumer-storefront/design-vehicle-finder-and-garage`).

#### Scenario: Last vehicle removed
- **GIVEN** a garage with one vehicle
- **WHEN** it is removed
- **THEN** listings return to the no-vehicle state

### Requirement: Addresses, payment methods, profile, security

The system SHALL manage addresses, saved payment methods (tokenised), profile and password, and delete account with the reseller's retention rules.

#### Scenario: Default address
- **GIVEN** two addresses
- **WHEN** one is set default
- **THEN** checkout prefills it

### Requirement: Subscriptions

The system SHALL, where the reseller offers recurring items (for example filters or wipers), list subscriptions with next renewal and allow skip, pause and cancel.

#### Scenario: Skip
- **GIVEN** an active subscription
- **WHEN** the shopper skips the next renewal
- **THEN** the next date moves by one period and the reseller's subscriptions view shows it

## Layout (proposed)

Two-column: left menu (Overview, Orders, Garage, Addresses, Payment methods, Subscriptions, Returns, Profile), right content in white bordered panels; menu becomes a select under 700 px. Reuse storefront tokens, 44 px fields and Archivo links.

## Gaps

Entire area undesigned. Required before build: all screens above plus empty and error states.

## Platform notes

Customer accounts per store with customer-store binding; load `commercetools-storefront` (B2C customer auth, recurring orders, wishlist) before building.

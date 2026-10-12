<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Customers and subscriptions (the reseller's shoppers)

## Purpose

Resellers own the customer relationship. They need to see who buys, act for a customer when helping them, and watch recurring orders.

Design source: `Malva Seller Portal.dc.html`, pages `customers` and `subs`.

## Requirements

### Requirement: Customers list

The system SHALL list customers with name, type (Registered or Guest), orders, lifetime value and last order, with tabs All, Registered, Guests and KPIs (Registered, Guests, Repeat rate).

#### Scenario: Guest tab
- **GIVEN** the Guests tab
- **WHEN** it renders
- **THEN** only guest checkouts appear, labelled "Checked out without an account"

### Requirement: Shop as customer

The system SHALL let permitted users open the storefront as a registered customer, with the persistent banner in `seller-portal/design-portal-shell-and-navigation`, a limited session length (2 minutes to start) and an audit entry.

#### Scenario: Audit
- **GIVEN** a seller user shopping as a customer
- **WHEN** an order is placed
- **THEN** it is marked as placed on behalf, with the seller user recorded

#### Scenario: Expiry
- **GIVEN** an idle customer session
- **WHEN** the limit passes
- **THEN** the session ends and the banner disappears

### Requirement: Privacy

The system SHALL show only customers of the signed-in reseller and mask data per role.

#### Scenario: Other reseller
- **GIVEN** a customer registered at reseller A
- **WHEN** reseller B searches for them
- **THEN** no result is returned

### Requirement: Subscriptions

The system SHALL show recurring orders with customer, product and quantity, interval, next renewal, value and status, with tabs Active, Paused, Canceled, KPIs (Monthly recurring, Active, Paused, Canceled) and a "Renewals in the next 7 days" panel.

#### Scenario: Paused
- **GIVEN** a customer pausing a subscription
- **WHEN** the Paused tab renders
- **THEN** it appears with a warning chip and no next renewal

### Requirement: Customer detail (later phase)

The system SHALL offer a customer detail page with orders, garage vehicles, subscriptions, returns and notes.

#### Scenario: Garage
- **GIVEN** a customer with two vehicles
- **WHEN** detail opens
- **THEN** both show, helping the seller recommend fitting parts

## Gaps

- No customer detail, search, export, segments or notes; no vehicle data. Subscriptions have no edit actions (skip, pause for customer).
- Customer data policy (what a reseller may see) is a legal decision.

## Platform notes

Customers belong to the reseller's store; subscriptions are recurring orders with recurrence policies. Load `commercetools-storefront` (CSR impersonation, recurring orders) and `commercetools-commerce-patterns` (recurring orders).

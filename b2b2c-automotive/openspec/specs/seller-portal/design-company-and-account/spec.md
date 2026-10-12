<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Company and team, account settings

## Purpose

> **Scope note (owner, 2026-10-12):** cost centres and the approval-rule scenario are dropped (wholesale buying from Malva is out of scope).

A reseller administers its people, addresses and budgets, and each person manages their own profile and security.

Design source: `Malva Seller Portal.dc.html`, pages `company` and `account`.

## Requirements

### Requirement: Users

The system SHALL list users with name, email, role, status (Active, Invited) and last active, with "Invite user".

#### Scenario: Invite
- **GIVEN** a new email and role
- **WHEN** invited
- **THEN** the user shows Invited until they accept

### Requirement: Addresses

The system SHALL list addresses with label, address, type (Delivery, Delivery & billing) and default marker, with "Add address".

#### Scenario: Default
- **GIVEN** two addresses
- **WHEN** one is made default
- **THEN** checkout prefills it

### Requirement: Cost centres and budget

The system SHALL list cost centres with code, name, quarterly budget, committed and remaining, mark very low remaining in critical text, and note that committed includes orders awaiting approval.

#### Scenario: Low remaining
- **GIVEN** €1,570 remaining of €90,000
- **WHEN** listed
- **THEN** the remaining figure is critical-coloured

#### Scenario: Over budget order
- **GIVEN** an order that would exceed remaining budget
- **WHEN** placed
- **THEN** a matching approval rule triggers (see `seller-portal/design-approvals-and-roles`)

### Requirement: Account settings

The system SHALL provide General (first name, last name, email), Security (current, new and repeat password with live check: "Enter a new password", "Too short", "Passwords don't match", "Looks good"; minimum 12 characters), Addresses, and Business units (unit, type, role, store).

#### Scenario: Weak password
- **GIVEN** a new password shorter than 12 characters
- **WHEN** typed
- **THEN** "Too short" shows and Update password reports "Fix the password first"

#### Scenario: Business units
- **GIVEN** a user in three divisions with different roles
- **WHEN** the tab renders
- **THEN** each row shows the role and store for that unit

### Requirement: Company profile (later phase)

The system SHALL show company profile (legal name, tax ID, account number, region, currency, credit limit and terms) as read-only for non-admins.

#### Scenario: Non-admin
- **GIVEN** a Buyer
- **WHEN** the profile renders
- **THEN** fields are read-only with a note to contact an administrator

## Gaps

- No remove or deactivate user, no role change UI, no MFA, no activity log, no division management, no data export or account deletion.

## Platform notes

Users are associates in the business unit hierarchy; cost centres are custom data on units and carts. Load `commercetools-commerce-patterns` (business-unit hierarchy) and `commercetools-storefront` (B2B session and BU).

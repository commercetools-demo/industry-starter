<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Portal registration without email verification

## Purpose

No email is sent anywhere in this project (decision Q-P01), so a registration request or an invitation could never be confirmed by email. A portal user created by registration is marked as verified at creation, and an invited user becomes verified when they accept the invitation. The seeded demo associates are verified too. Owner request, 2026-10-13.

Design source: none (no screen changes).

## Requirements

### Requirement: Registered users are created verified

The system SHALL create the customer of a registration request with `isEmailVerified: true` and SHALL NOT create an email token, send a link or show a verification step.

The registration still waits for approval where the auth-screens spec says so: verification does not approve anything, and an unapproved user still cannot sign in to a business unit.

#### Scenario: A registration request
- **GIVEN** the register page with a new email address
- **WHEN** the request is submitted
- **THEN** the customer exists with `isEmailVerified` true and the pending-approval screen is shown

#### Scenario: Verified is not approved
- **GIVEN** a verified customer whose request is not approved
- **WHEN** they try to use the portal
- **THEN** they see the pending-approval screen, not the dashboard

### Requirement: Invited users are verified when they accept

The system SHALL create an invited user unverified (the user list shows "Invited") and SHALL mark them verified when they set their password through the invitation link, so that they appear as "Active" afterwards.

#### Scenario: Accepting an invitation
- **GIVEN** an invited user shown as "Invited"
- **WHEN** they open the invitation link and set a password
- **THEN** the customer is verified and the user list shows them as "Active"

### Requirement: Seeded demo associates are verified

The seed SHALL create every demo associate verified and SHALL verify any that already exist unverified.

#### Scenario: An existing unverified demo associate
- **GIVEN** a demo associate that exists with `isEmailVerified` false
- **WHEN** the seed runs
- **THEN** the associate is verified and a second run changes nothing

### Requirement: Approval gate is off until switched on

The system SHALL NOT check a business unit's status at sign-in unless `PORTAL_REQUIRE_APPROVAL` is `true`. By default a user whose unit has a store signs in whatever the unit's status. With the variable `true`, a user whose units are all not Active sees the pending-approval screen. A unit without a store is never usable, so its users see the pending-approval screen with the variable on or off.

#### Scenario: Default
- **GIVEN** `PORTAL_REQUIRE_APPROVAL` is absent and the user's unit is Inactive but has a store
- **WHEN** the user signs in
- **THEN** the portal opens on that unit's store

#### Scenario: Approval required
- **GIVEN** `PORTAL_REQUIRE_APPROVAL=true` and the user's only unit is Inactive
- **WHEN** the user signs in
- **THEN** the pending-approval screen is shown

### Requirement: Seeded units have stores

The seed SHALL give every unit with an associate a store: each reseller its own store, Malva Global both stores, and the other units SHALL inherit from their parent. A unit that exists without them SHALL be repaired by the next seed run (mode and stores in one `setStoreMode` action).

#### Scenario: Existing unit without a store
- **GIVEN** a seeded reseller unit that has no store
- **WHEN** the seed runs
- **THEN** the unit has its store and a second run changes nothing

## Notes

Known gap (accepted with the on-screen password reset, D4): an email address is not proven to belong to the person who typed it. Only a demo deployment should run this way.

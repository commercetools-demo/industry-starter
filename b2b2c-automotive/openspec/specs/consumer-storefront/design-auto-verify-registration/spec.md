<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Storefront registration without email verification

## Purpose

No email is sent anywhere in this project (decision Q-P01), so a shopper who registers could never complete an email verification step. A new account is therefore marked as verified at creation, and no part of the storefront asks for verification. The seeded demo accounts are verified the same way. Owner request, 2026-10-13.

Design source: none (no screen changes).

## Requirements

### Requirement: New accounts are created verified

The system SHALL create every storefront customer with `isEmailVerified: true`: shoppers who register on the register page and accounts created when a guest claims an order.

The system SHALL NOT create an email token, send a verification link or ask the shopper to confirm an address, and SHALL NOT block sign-in, checkout or any account page on a verification status.

#### Scenario: A shopper registers
- **GIVEN** the register page with a new email address and a valid password
- **WHEN** the form is submitted
- **THEN** the customer exists with `isEmailVerified` true, the shopper is signed in at once and no verification step appears

#### Scenario: A guest claims an order into an account
- **GIVEN** a guest order and an email with no account
- **WHEN** the guest creates the account to claim the order
- **THEN** the new customer is verified

#### Scenario: Sign-in never asks for verification
- **GIVEN** any storefront customer, verified or not
- **WHEN** the customer signs in
- **THEN** sign-in succeeds on email and password alone

### Requirement: Seeded demo accounts are verified

The seed SHALL create every demo customer verified and SHALL verify any demo customer that already exists unverified (through the email token and confirm calls, because the API has no update action for it).

#### Scenario: An existing unverified demo account
- **GIVEN** a demo customer that exists with `isEmailVerified` false
- **WHEN** the seed runs
- **THEN** the customer is verified and a second run changes nothing

## Notes

Known gap (accepted with the on-screen password reset, D4): an email address is not proven to belong to the person who typed it. Only a demo deployment should run this way.

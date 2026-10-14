<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Portal sign in, registration and password reset

## Purpose

Resellers sign in to the portal with company accounts. New businesses register and wait for Malva's approval before they can order or sell.

Design source: `Malva Seller Portal.dc.html`, auth overlay (`login`, `register`, `reset`, `sent`).

## Requirements

### Requirement: Sign in

The system SHALL authenticate email and password and refuse failures with one message that does not reveal whether the email exists.

#### Scenario: Wrong credentials
- **GIVEN** an unknown email and a known email with a wrong password
- **WHEN** either is submitted
- **THEN** both show the same message

#### Scenario: Missing field
- **GIVEN** an empty password
- **WHEN** Sign in is pressed
- **THEN** "Fill in every field to continue." shows and nothing is sent

### Requirement: Registration needs Malva approval

The system SHALL collect company name, name, work email and password, create the account in a pending state and tell the user "Account created. Awaiting Malva approval of your business."

#### Scenario: Pending account
- **GIVEN** a newly registered business
- **WHEN** it signs in before approval
- **THEN** it reaches a status page, not the portal

### Requirement: Password reset without enumeration

The system SHALL accept an email and always show "Check your inbox — If an account exists for that email, a reset link is on its way."

#### Scenario: Unknown email
- **GIVEN** an email with no account
- **WHEN** reset is requested
- **THEN** the same confirmation shows and no email is sent

### Requirement: Layout

The system SHALL show a centred 440 px card on the page canvas with the logo mark, title, subtitle, fields (44 px), primary button (48 px), a secondary link row (Create account, Forgot password?, Back to sign in).

#### Scenario: Demo credentials
- **GIVEN** a non-production environment
- **WHEN** the card renders
- **THEN** the demo account picker of `seller-portal/design-demo-login` is shown (it replaces the single "Use demo credentials" button), and in production it is absent

## Gaps

- Design has no SSO / federated sign-in, no MFA, no password strength rules (the account page requires 12 characters; use the same here), no invite acceptance, no pending-approval page and no terms checkbox.
- Registration has no tax ID, country or reseller type fields that Malva needs to approve a business; add after confirming approval rules.

## Platform notes

Company registration creates a business unit awaiting approval; load `commercetools-storefront` (B2B customer auth) and `commercetools-commerce-patterns` before building.

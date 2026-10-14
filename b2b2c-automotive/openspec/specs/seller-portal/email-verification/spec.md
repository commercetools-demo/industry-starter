<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Email verification by token with a recoverable resend path

## Purpose

Verification proves the buyer controls the address the account is keyed on, which is what makes later recovery and notification trustworthy. The page is reached by clicking a link that may be hours or days old, so the expired case is the common case rather than the exception, and a dead end there abandons an account that has already been created.

## Requirements

### Requirement: Email verification by token with a recoverable resend path

The system SHALL record an email address as verified only when the request carries a verification token that is unexpired and was issued for that account, and otherwise report the outcome as a recoverable state offering a fresh verification email.

#### Scenario: Token valid address confirmed
- **GIVEN** a verification link opened while its token is still valid
- **WHEN** the page loads
- **THEN** the address is recorded as verified on the account and the buyer is sent to the configured destination without a further click

#### Scenario: Token expired
- **GIVEN** a verification link whose token has expired
- **WHEN** the page loads
- **THEN** the page states that the link expired, offers to send a new one, and does not retry the dead token silently

#### Scenario: Resend needs an identified account
- **GIVEN** a visitor who opens an expired link with no active session
- **WHEN** they ask for a new verification email
- **THEN** they are asked to sign in first, because a new token can only be requested for an account the storefront can identify

#### Scenario: Link opened twice
- **GIVEN** an account whose address is already verified
- **WHEN** the same verification link is opened again
- **THEN** the buyer is told the address is already confirmed and routed to the configured destination, rather than shown a token error

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Token validation and status | `[MIDDLEWARE]` | Identity service token check |
| Resend verification email | `[MIDDLEWARE]` | Triggers a new email from the identity service |
| Redirect on success | `[STATIC]` | Config-driven redirect target |

## commercetools

**Entities:** `Customer`, `CustomerToken`, `Store`

**Verified API surface**

- (rest) POST /{projectKey}/customers/email/confirm takes tokenValue and, when the token is valid and unexpired, sets isEmailVerified to true on the Customer; an invalid or expired token returns an error — [docs](https://docs.commercetools.com/learning-implement-carts-and-shopping-lists/manage-signups-and-signins/customer-signup-and-email-verification)

**Constraints that change the design**

- POST /{projectKey}/customers/email-token requires the Customer id and ttlMinutes - unlike the password reset token endpoint it does not accept an email address, so a resend needs the account already identified from a session or a server-side lookup — [docs](https://docs.commercetools.com/api/projects/customers)
- Email templates and delivery belong to an external email service provider, not to commercetools; commercetools only issues the token — [docs](https://docs.commercetools.com/learning-implement-carts-and-shopping-lists/manage-signups-and-signins/customer-signup-and-email-verification)
- The CustomerEmailTokenCreated message includes tokenValue only when ttlMinutes is 60 or fewer; for longer validity the value is omitted, so a subscription-driven resend must keep the token short-lived — [docs](https://docs.commercetools.com/learning-implement-carts-and-shopping-lists/manage-signups-and-signins/customer-signup-and-email-verification)
- For a Store-specific customer use /{projectKey}/in-store/key={storeKey}/customers/email-token; if the customer exists in the Project but its stores field references a different Store, the in-store endpoint returns a ResourceNotFound error — [docs](https://docs.commercetools.com/api/projects/customers)

**Modeling notes**

Keep the verified flag as the single source of truth for whether the address is proven, and decide separately what an unverified account is allowed to do - the platform does not gate anything on it by itself. The resend path is the part that gets designed wrong: because the token endpoint is keyed on the Customer id, a resend from a cold link needs the account resolved server-side, so plan for either an authenticated resend or a middleware lookup rather than a form that takes an email address. Keep validity at or below 60 minutes if a connector is to deliver the email from the token-created message.

## commercetools skills

Load `commercetools-storefront` before implementing this capability. Supporting: `commercetools-platform`, `commercetools-connect`. Any task generated from this spec carries `[SKILL: commercetools-storefront]`.

## Open questions

- Is a verification token invalidated once used, so a second click on the same link fails, or can the link be replayed until it expires?
- For an email-change flow, is the new address written to the account before or after verification, and which address signs the buyer in during the gap?
- What is a company buyer allowed to do before their address is verified - browse only, or order, given company activation is a separate gate?
- Which system issues the token when an external identity provider owns credentials, and does the commercetools verified flag then need syncing at all?

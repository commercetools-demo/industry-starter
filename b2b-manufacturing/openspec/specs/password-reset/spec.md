<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Password reset gated on a valid, unexpired reset token

## Purpose

Account recovery is the one unauthenticated flow that hands over control of an account, so the token is the whole of the authorization. Two things follow: the token has to be validated on the server before the new password is accepted, and the page must never let its own responses reveal which email addresses have accounts, since that turns recovery into an account-enumeration tool.

## Requirements

### Requirement: Password reset gated on a valid, unexpired reset token

The system SHALL change an account's password only when the submission carries a reset token that is unexpired and was issued for that account, refusing unknown, expired and already-consumed tokens with a path to request a new one.

#### Scenario: Token valid password changed
- **GIVEN** a reset link opened while its token is still within its validity window
- **WHEN** a new password that satisfies the password policy is submitted
- **THEN** the password is changed and the buyer is required to sign in again, because sessions issued before the reset no longer authenticate

#### Scenario: Token expired or consumed
- **GIVEN** a reset link whose token has expired or has already been used
- **WHEN** the page loads
- **THEN** the page states that the link is no longer usable and lets a new reset be requested from that same page, without sending the buyer back to sign-in to start over

#### Scenario: Address with no account
- **GIVEN** an email address that matches no account
- **WHEN** a reset is requested for it
- **THEN** the confirmation shown is indistinguishable from the one shown for a known address, and no message, timing hint or error discloses that the account does not exist

#### Scenario: Password fails policy
- **GIVEN** a new password that does not satisfy the password policy
- **WHEN** it is submitted
- **THEN** it is refused before any call to the identity service, naming the rule it failed

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Email input and submit | `[MIDDLEWARE]` | Triggers the reset email via the identity service |
| Token validation | `[MIDDLEWARE]` | Validates the reset token carried by the email link |
| New password form and submission | `[MIDDLEWARE]` | Writes to the identity service |
| Password strength indicator | `[STATIC]` | Client-side validation |

## commercetools

**Entities:** `Customer`, `CustomerToken`, `Store`

**Verified API surface**

- (rest) POST /{projectKey}/customers/password-token takes the customer's email plus optional ttlMinutes and invalidateOlderTokens, and returns a CustomerToken carrying value (the reset token) and expiresAt — [docs](https://docs.commercetools.com/api/projects/customers)
- (rest) POST /{projectKey}/customers/password/reset takes tokenValue and newPassword; on success the access and refresh tokens previously issued through the password flow and refresh token flow are invalidated, with eventual consistency — [docs](https://docs.commercetools.com/learning-implement-carts-and-shopping-lists/manage-signups-and-signins/password-reset-flow)

**Constraints that change the design**

- commercetools returns the reset token to the caller and does not deliver it - sending the link to the customer's registered address is the application's job, so an email service provider is part of this flow and not an optional extra — [docs](https://docs.commercetools.com/learning-implement-carts-and-shopping-lists/manage-signups-and-signins/password-reset-flow)
- The password reset flow deliberately does not reveal whether the submitted email address exists, so the storefront must not add a not-found response of its own on top of it — [docs](https://docs.commercetools.com/learning-implement-carts-and-shopping-lists/manage-signups-and-signins/password-reset-flow)
- Creating a password reset token produces a CustomerPasswordTokenCreated Message that carries the token's value only when the token's validity is 60 minutes or less; a longer-lived token is omitted from the message, so a subscription-driven email cannot deliver it — [docs](https://docs.commercetools.com/api/projects/customers)
- A Store-specific customer must use the in-store variant /{projectKey}/in-store/key={storeKey}/customers/password-token; if the customer exists in the Project but its stores field references a different Store, that endpoint returns a ResourceNotFound error — [docs](https://docs.commercetools.com/api/projects/customers)

**Modeling notes**

Two delivery designs exist and the choice is architectural: call the token endpoint from the middleware and hand the token to the email provider synchronously, or subscribe to the token- created message and let a connector send it. The second only works while the token's validity is at most 60 minutes, because longer-lived tokens are stripped from the message. Either way the token never reaches the browser except inside the emailed link, and the reset submission is server-side. Where an external identity provider owns credentials, none of this applies: the commercetools Customer is then a profile record and the token flow belongs to that provider.

## commercetools skills

Load `commercetools-storefront` before implementing this capability. Supporting: `commercetools-platform`, `commercetools-connect`. Any task generated from this spec carries `[SKILL: commercetools-storefront]`.

## Open questions

- Does commercetools own credentials for this storefront, or does an external identity provider, in which case the token endpoints, TTL and password policy all move there?
- What token validity applies, and does requesting a second reset invalidate the first link - that is, is invalidateOlderTokens set on the request?
- Where is the password policy enforced so the client-side strength indicator and the server agree on a single set of rules?
- Do buyers in Stores need the in-store token endpoints, and if so how does the page resolve the Store before the buyer is authenticated?

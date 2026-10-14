<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Authentication and identity

## Purpose

Anything the buyer built before signing in is lost unless it is deliberately carried across, and the sign-in surface is the most probed part of a storefront: error messages that distinguish "unknown email" from "wrong password" hand an attacker a list of valid accounts.

## Requirements

### Requirement: Authentication and identity

The storefront SHALL establish an authenticated session for a returning buyer, and carry any work the buyer did anonymously into that session, without revealing whether a given email is registered.

#### Scenario: Sign in carries the anonymous cart
- **GIVEN** an anonymous buyer with items in a cart
- **WHEN** the buyer signs in to an existing account
- **THEN** the anonymous cart is merged into or becomes the customer's active cart, and no items are silently dropped

#### Scenario: Failed sign in is ambiguous
- **GIVEN** a sign-in attempt with an email that is not registered, and one with a wrong password
- **WHEN** either fails
- **THEN** the buyer sees the same generic message, and nothing distinguishes the two cases

#### Scenario: Password reset does not confirm the email
- **GIVEN** a password reset requested for an address that may or may not be registered
- **WHEN** the request is submitted
- **THEN** the response is identical either way, and any reset link is delivered only by email

#### Scenario: Verification before recovery
- **GIVEN** an account whose email address has never been verified
- **WHEN** the buyer attempts password recovery
- **THEN** the flow states what is required rather than failing opaquely

## Pages

- [Landing page with session-resolved buyer context](../home-landing-page/spec.md)
- [Account request held until the seller activates it](../account-registration-request/spec.md)
- [Buyer sign-in with password or federated identity](../account-sign-in/spec.md)
- [Error pages that name the failure and route the buyer back](../error-pages/spec.md)
- [Password reset gated on a valid, unexpired reset token](../password-reset/spec.md)
- [Email verification by token with a recoverable resend path](../email-verification/spec.md)

## commercetools

**Entities:** `Customer`, `Cart`, `Store`

**Verified API surface**

- (rest) Sign-in has two endpoints: global POST /{projectKey}/login and store-specific POST /{projectKey}/in-store/key={storeKey}/login. A store-specific Customer must use their store's endpoint; a global Customer can use either — [docs](https://docs.commercetools.com/api/customers-overview)
- (concept) CustomerSignin takes an optional anonymousId or anonymousCart plus anonymousCartSignInMode — MergeWithExistingCustomerCart (default) or UseAsNewActiveCustomerCart — which is how anonymous work is carried into the session — [docs](https://docs.commercetools.com/api/customers-overview)
- (rest) Password reset is two steps: POST /{projectKey}/customers/password-token to mint a short-TTL token, then POST /{projectKey}/customers/password/reset with that token and the new password — [docs](https://docs.commercetools.com/api/customers-overview)
- (rest) Email verification mints a token via POST /{projectKey}/customers/email-token with a ttlMinutes, then confirms it; verification activates the account and enables password recovery — [docs](https://docs.commercetools.com/learning-implement-carts-and-shopping-lists/manage-signups-and-signins/customer-signup-and-email-verification)

**Constraints that change the design**

- The InvalidCredentials 400 error is deliberately generic and does not say whether the email, the password or the store association was wrong; it exists to prevent account enumeration, so the UI must mirror that ambiguity — [docs](https://docs.commercetools.com/learning-implement-carts-and-shopping-lists/manage-signups-and-signins/customer-signin)
- commercetools does not manage sessions. Creating, storing, validating, expiring and refreshing the session token is the application backend's responsibility — [docs](https://docs.commercetools.com/learning-implement-carts-and-shopping-lists/manage-signups-and-signins/customer-signin)

**Modeling notes**

The session boundary lives in the BFF, not in commercetools: mint an HttpOnly, Secure cookie after a successful sign-in and validate it on every subsequent request. Never log a reset or verification token. Decide MergeWithExistingCustomerCart versus UseAsNewActiveCustomerCart deliberately — the default merges, which is usually right but is a business decision.

## commercetools skills

Load `commercetools-platform` before implementing this capability. Supporting: `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-platform]`.

## Open questions

- Are buyers global or store-scoped Customers? That decides which sign-in endpoint is correct.
- Is SSO or federated login required, and if so which identity provider fronts it?

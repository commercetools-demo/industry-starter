<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Buyer sign-in with password or federated identity

## Purpose

Sign-in is the only page on the account group that an unauthenticated stranger can reach, so it is where account enumeration, credential stuffing and session fixation are attempted. Enterprise buyers additionally arrive through their own identity provider rather than a password, which is a different trust path with different cart and session consequences, not a styling variant of the same form.

## Requirements

### Requirement: Buyer sign-in with password or federated identity

The system SHALL establish an authenticated buyer session only after the presented credentials or federated assertion are validated, and refuse every other attempt with a message that does not reveal whether the identifier exists.

#### Scenario: Credentials accepted
- **GIVEN** a registered buyer with a usable password
- **WHEN** the correct credentials are submitted
- **THEN** a session scoped to that buyer is issued and their most recently modified active cart comes back with it

#### Scenario: Unknown and wrong are indistinguishable
- **GIVEN** one unregistered email address and one registered address with the wrong password
- **WHEN** either is submitted
- **THEN** both produce the same refusal text, and nothing in the response indicates which address exists

#### Scenario: Buyer bound to another entry point
- **GIVEN** a buyer whose account is bound to a single storefront or store
- **WHEN** they submit correct credentials at a different entry point
- **THEN** the attempt is refused with the same generic text and the buyer is directed to the entry point that owns their account

#### Scenario: Federated buyer has no local password
- **GIVEN** a buyer whose organization authenticates through its own identity provider
- **WHEN** the provider returns a valid assertion for that buyer
- **THEN** the session is established against the linked buyer record without any password being submitted to the storefront

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Email and password fields | `[STATIC]` | UI shell |
| SSO or federated login button | `[STATIC]` | Config-driven; the auth flow itself is middleware |
| Authentication call | `[MIDDLEWARE]` | Credential validation, session token issuance |
| Error messaging | `[MIDDLEWARE]` | Response from the auth service |
| Forgot password link | `[STATIC]` | Navigation |

## Design

Reference: `design/specs/login.md`.

A centered 440px card on a honey-tinted band: H1 "Log in", Email and Password pill inputs, inline error line, full-width "Log in" pill. After success the buyer returns to the page that required sign-in (account or bundle checkout).

Design-to-spec mapping and deviations:

- The design shows password sign-in only; federated sign-in, registration, "forgot password" and email verification links are not designed.
- Inputs remove the browser outline with no replacement: a visible focus style is required.
- There is no error token; use the proposed `--color-danger` (see `design-system-tokens`) and keep the message in an element announced to assistive technology.
- "Demo account is prefilled" is prototype-only.

## commercetools

**Entities:** `Customer`, `CustomerToken`, `Cart`, `Store`, `BusinessUnit`

**Verified API surface**

- (rest) POST /{projectKey}/login returns a CustomerSignInResult with the Customer and, where one exists, the active Cart; passing anonymousCart assigns one guest cart and anonymousId assigns all Carts, Orders, ShoppingLists and Payments held under that id — [docs](https://docs.commercetools.com/api/customers-overview)
- (rest) The password flow POST /oauth/{projectKey}/customers/token issues a customer access token (48 hours by default) with a refresh token; refreshing yields a fresh access token but does not extend the refresh token's own validity — [docs](https://docs.commercetools.com/api/authorization)

**Constraints that change the design**

- The InvalidCredentials error is deliberately ambiguous - it never says whether the email, the password or the Store association was wrong - so the storefront cannot render a specific reason and must not try to derive one by probing — [docs](https://docs.commercetools.com/learning-implement-carts-and-shopping-lists/manage-signups-and-signins/customer-signin)
- A Store-specific Customer cannot authenticate through the global /login endpoint at all; it must use /in-store/key={storeKey}/login, and a password-flow token requested in-store is valid only for that Store — [docs](https://docs.commercetools.com/api/customers-overview)
- Automatic cart merge on sign-in applies only to Customers authenticated through the internal OAuth service; an externally authenticated buyer needs the explicit Merge Cart endpoint instead — [docs](https://docs.commercetools.com/api/customers-overview)
- commercetools does not introspect a third-party identity provider's token; the storefront's server tier validates the assertion, resolves the Customer by externalId (creating it on first sign-in) and then calls the API with its own client credentials — [docs](https://docs.commercetools.com/learning-implement-carts-and-shopping-lists/manage-signups-and-signins/third-party-identity-providers)

**Modeling notes**

Decide where identity lives before building the page: commercetools-native passwords and an external identity provider diverge on cart merge, on email verification and on where lockout and multi-factor policy are enforced. Either way the customer token belongs in the server tier and the browser holds only an opaque session cookie, because the token carries the buyer's scopes.

## commercetools skills

Load `commercetools-platform` before implementing this capability. Supporting: `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-platform]`.

## Open questions

- Which identity provider owns enterprise buyers, and does it also own multi-factor and lockout policy, or must the storefront tier rate-limit sign-in itself?
- Are buyer accounts store-scoped? If so the sign-in surface has to know the store before it can authenticate anyone.

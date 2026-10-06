<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Account request held until the seller activates it

## Purpose

A self-registered buyer has not yet been vetted: for a business account the seller still has to check tax and credit details and decide which assortment and prices apply, and for a consumer account the address still has to be proven. Activating on submission would let an unvetted buyer transact at default prices, so the request and the active account are two different states and the page has to make the difference visible.

## Requirements

### Requirement: Account request held until the seller activates it

The system SHALL record a submitted account request and withhold any ordering capability from it until the seller's activation step has completed.

#### Scenario: Request recorded not active
- **GIVEN** a visitor who has completed the form
- **WHEN** the request is submitted
- **THEN** the account and, for a business buyer, its organization are recorded, the buyer is told activation is pending, and no path to ordering is offered

#### Scenario: Address already registered
- **GIVEN** an email address that already belongs to an account
- **WHEN** the request is submitted
- **THEN** the submission is refused without confirming that the address is registered, and sign-in and password-reset paths are offered instead

#### Scenario: Verification link expired
- **GIVEN** a verification link whose token has passed its lifetime
- **WHEN** the buyer opens it
- **THEN** the failure is stated plainly and a fresh verification message can be requested from the same page

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Company and contact fields | `[STATIC]` | UI form shell |
| Form submission | `[MIDDLEWARE]` | Creates a pending account record |
| Confirmation and status state | `[MIDDLEWARE]` | Response from the registration service |

## commercetools

**Entities:** `Customer`, `BusinessUnit`, `CustomerToken`, `AssociateRole`, `Store`, `Type`

**Verified API surface**

- (rest) POST /{projectKey}/customers creates the Customer with isEmailVerified false; POST /customers/email-token then POST /customers/email/confirm completes verification, and sending the message is the implementation's job, not the platform's — [docs](https://docs.commercetools.com/api/customers-overview)
- (concept) Provisioning order is fixed: create the Associate Roles, then the Customer, then add the Customer as an Associate with role assignments - roles must exist before they can be assigned — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-associate-access/customers-and-associates)

**Constraints that change the design**

- A Business Unit created through the My Business Units API is Inactive by default and its status cannot be changed through that API, so the merchant inspects it, assigns Products and Prices and activates it from a trusted context; the default is a Project-level setting — [docs](https://docs.commercetools.com/api/projects/me-business-units)
- The My Business Units API also refuses to manage a unit's Stores or to assign Associates, so seating the first colleague of a newly registered company runs server-side with addAssociate on the Business Unit — [docs](https://docs.commercetools.com/api/projects/me-business-units)
- The Change Email update action resets isEmailVerified to false even when the address submitted is identical to the current one, so a profile edit can silently de-verify an active account — [docs](https://docs.commercetools.com/api/customers-overview)

**Modeling notes**

Model the pending organization as the Business Unit itself in its inactive state plus a custom field carrying the review status; do not invent a parallel pending-account resource that then has to be reconciled. For a consumer account the same page collapses to Customer creation plus email verification, with no organization and no seller review.

## commercetools skills

Load `commercetools-storefront` before implementing this capability. Supporting: `commercetools-commerce-patterns`. Any task generated from this spec carries `[SKILL: commercetools-storefront]`.

## Open questions

- Which attributes does credit and tax review actually need at submission (tax id, credit references, trade references), and are they held on the organization or in the seller's CRM?
- Does a buyer with a recorded but unactivated request see a default assortment, a price-free catalog, or nothing at all?

---

_Excluded for B2C: Industry or segment dropdown._

<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Error pages that name the failure and route the buyer back

## Purpose

The three failures share a shell but not a recovery: a dead URL is recovered by searching, a refused action is recovered by asking whoever administers the buyer's permissions, and a server fault is recovered by retrying. Collapsing them into one generic apology converts a permission problem into a support ticket, because the buyer cannot tell that the storefront worked correctly and their access did not.

## Requirements

### Requirement: Error pages that name the failure and route the buyer back

The system SHALL answer a request it cannot fulfill with a page that states which condition occurred — an address that resolves to nothing, an action the buyer is not permitted to take, or a fault on the seller's side — and that offers at least one route back into the storefront.

#### Scenario: Address resolves to nothing
- **GIVEN** a URL that matches no page, category or product, including one whose product was unpublished
- **WHEN** the storefront handles the request
- **THEN** a not-found response is returned carrying the search entry point and the top-level navigation, and no partially rendered page shell is served

#### Scenario: Action outside permissions
- **GIVEN** a buyer whose roles in their company do not carry the permission the attempted action requires
- **WHEN** the middleware calls the platform on their behalf and the call is refused
- **THEN** the unauthorized page states that the action was refused for their account rather than that it failed, and none of the requested resource's data is rendered

#### Scenario: Upstream fault
- **GIVEN** an upstream call fails or exceeds its timeout while assembling a page
- **WHEN** the page cannot be completed
- **THEN** a server-error page is returned with a retry route, and the buyer's session and cart are left intact

#### Scenario: Expired session is not a refusal
- **GIVEN** a visitor whose session has expired
- **WHEN** they open a URL that requires authentication
- **THEN** they are routed to sign-in with the original destination preserved, not to the unauthorized page

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Error message and copy | `[STATIC]` | CMS-managed or hardcoded |
| Search bar (404) | `[STATIC]` | UI shell; the query itself is MIDDLEWARE |
| Navigation links | `[STATIC]` | Config-driven |

## commercetools

**Entities:** `Customer`, `BusinessUnit`, `AssociateRole`

**Constraints that change the design**

- A failed permission check on an as-associate endpoint returns 403 with an AssociateMissingPermission error naming the associate, the business unit and the permission(s) required - the unauthorized page can therefore state what was missing instead of a bare denial — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-associate-access/api-endpoint-patterns-for-b2b)
- as-associate endpoints check permissions against the URL parameters but do not validate those parameters against the token's scopes, so they may only be called from trusted middleware - authorization refusals therefore surface in the middleware tier, which is what renders the unauthorized page — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-associate-access/api-endpoint-patterns-for-b2b)
- The me endpoints do not evaluate View permissions: an associate can read every resource reachable there regardless of their roles. A storefront that relies on a platform refusal to hide another buyer's data must read through the as-associate endpoints instead — [docs](https://docs.commercetools.com/api/associates-overview)
- Removing an associate from a Business Unit does not revoke their access to the Carts, Orders, Quotes and Quote Requests already associated with it - they must also be removed from each entity, so revocation alone will not produce a refusal — [docs](https://docs.commercetools.com/api/associates-overview)

**Modeling notes**

Treat the three pages as one component with a discriminator, not three templates. The discriminator is set in the middleware tier, because that is where a platform refusal is observed; the page itself stays STATIC and must render with no session and no catalog call, so it survives the outage that produced it. Keep the platform's error message out of the buyer- facing copy - it carries associate and business unit identifiers - and map the permission names it returns onto the storefront's own vocabulary.

## commercetools skills

Load `commercetools-storefront` before implementing this capability. Supporting: `commercetools-platform`. Any task generated from this spec carries `[SKILL: commercetools-storefront]`.

## Open questions

- Does the unauthorized page show the buyer the name of the missing permission, or only a reference their company administrator can quote to support?
- Is the server-error page allowed to be served from the CDN when the middleware tier is itself the component that failed?
- Which conditions must be a soft 404 with recovery content versus a hard redirect - for example a product retired from the assortment but still linked from an email campaign?

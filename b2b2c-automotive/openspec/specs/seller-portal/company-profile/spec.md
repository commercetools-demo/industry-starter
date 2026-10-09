<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Company profile with permission-gated editing

## Purpose

The company record decides who the seller invoices, under which tax identity, and at which address, so an unauthorised edit is a financial event rather than a cosmetic one. The platform evaluates the permission server-side and answers a request that lacks it with an error, which means a storefront that only hides the edit control has not implemented the control at all.

## Requirements

### Requirement: Company profile with permission-gated editing

The system SHALL accept a change to the buying company's master record — legal identity, billing addresses or unit hierarchy — only from an associate whose role carries the matching company-level permission, and refuse the attempt without applying any part of it otherwise.

#### Scenario: Administrator edits billing address
- **GIVEN** an associate whose role carries the permission to change company details
- **WHEN** they submit a new registered billing address
- **THEN** the change is persisted on the company record and is visible to every associate of that company

#### Scenario: Edit without permission refused
- **GIVEN** an associate whose role carries no company-level permission
- **WHEN** they submit a change to the company's legal name
- **THEN** the request is refused, the stored record is unchanged, and the refusal names the permission required

#### Scenario: Sub unit without its own address
- **GIVEN** a newly linked sub-unit that has no address of its own
- **WHEN** the profile lists the company's sub-units
- **THEN** that sub-unit is shown as lacking an address, because addresses are never inherited from the parent unit

#### Scenario: Account manager lookup unavailable
- **GIVEN** the CRM holding the assigned account manager cannot be reached
- **WHEN** the profile is opened
- **THEN** the rest of the record renders and the account manager card states that the contact could not be loaded

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Company name, legal info, tax IDs | `[MIDDLEWARE]` | Account master data |
| Billing address | `[MIDDLEWARE]` | Account address records |
| Assigned account manager card | `[MIDDLEWARE]` | CRM integration |
| Edit controls | `[MIDDLEWARE]` | Write to account service (admin only) |
| Linked sub-companies / business units | `[MIDDLEWARE]` | Account hierarchy |

## commercetools

**Entities:** `BusinessUnit`, `Associate`, `AssociateRole`, `Customer`, `Type`, `Store`

**Verified API surface**

- (concept) A BusinessUnit models the buyer organization: a Company has no parentUnit, a Division references one, every unit carries topLevelUnit, and hierarchies run up to 5 levels with up to 4000 descendants per top-level unit
 — [docs](https://docs.commercetools.com/api/projects/business-units)

**Constraints that change the design**

- Through the as-associate endpoints, UpdateBusinessUnitDetails is required for every update action except associate management (UpdateAssociates) and changeParentUnit (UpdateParentUnit); a missing permission returns AssociateMissingPermission
 — [docs](https://docs.commercetools.com/api/projects/associate-business-units)
- The me endpoints do not validate View permissions, so an associate can read every resource exposed there regardless of their role - read gating on a company profile has to be designed deliberately and cannot be assumed from the role model
 — [docs](https://docs.commercetools.com/api/associates-overview)
- Addresses and Custom Fields are never inherited between Business Units. A sub-unit that inherits Stores and associates from its parent still needs its own addresses, and an order cannot be placed for a unit that has none
 — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/model-buyer-organizations/stores-and-business-units)
- The BusinessUnit update actions cover name, addresses, contactEmail, stores, associates, customer group assignments and custom fields - there is no action for a tax registration identifier, so tax IDs are carried as Custom Fields via setCustomField
 — [docs](https://docs.commercetools.com/api/projects/business-units)
- setUnitType is not available on the Me or as-associate API, and only one hierarchy move runs at a time - a concurrent changeParentUnit, or an in-flight asynchronous topLevelUnit update, returns ConcurrentModification
 — [docs](https://docs.commercetools.com/api/projects/business-units)
- When an associate adds or changes associates through the as-associate endpoints, the API accepts only AssociateRoles whose buyerAssignable property is true, so sensitive roles stay outside the buyer portal
 — [docs](https://docs.commercetools.com/api/projects/associate-business-units)

**Modeling notes**

The profile is one read/write surface over a single BusinessUnit, reached through the as-associate endpoints so the platform - not the storefront - decides whether the edit is allowed. Fields the seller's master data owns (legal name, tax identity) are candidates for a read-only render sourced from the ERP even where commercetools holds a copy; decide which system is authoritative before exposing an edit control for them. Because addresses do not inherit, treat the sub-unit list as an operational checklist and surface units that are not yet orderable.

## commercetools skills

Load `commercetools-storefront` before implementing this capability. Supporting: `commercetools-commerce-patterns`, `commercetools-platform`. Any task generated from this spec carries `[SKILL: commercetools-storefront]`.

## Open questions

- Is the seller's ERP or commercetools the master for legal name and tax identifiers, and is the storefront view read-only as a result?
- Which role in the buyer's own vocabulary maps to the permission that can change company details, and who assigns it during onboarding?
- Does the account manager assignment need to be visible to every associate, or only to administrators?

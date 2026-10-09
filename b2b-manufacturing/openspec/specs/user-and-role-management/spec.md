<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Company user and role administration

## Purpose

A portal that lists every role in the project invites an administrator to grant themselves the approval authority the seller defined roles specifically to withhold. The platform already refuses a non-assignable role at the API, so a picker that offers one produces a failed save with no explanation the administrator can act on. Filtering the picker to the assignable set is therefore both the security control and the usability fix, and it is the one behavior on this page whose absence is silently exploitable.

## Requirements

### Requirement: Company user and role administration

The system SHALL offer a company administrator only those roles the seller has marked as buyer-assignable when granting a team member access, and reject an assignment naming any other role.

#### Scenario: Only assignable roles offered
- **GIVEN** a project with a buyer role marked buyer-assignable and an approver role marked not assignable
- **WHEN** the administrator opens the role selector for a team member
- **THEN** the buyer role is offered and the approver role is absent from the list

#### Scenario: Non assignable role refused
- **GIVEN** a request naming a role the seller marked as not buyer-assignable
- **WHEN** the administrator submits it
- **THEN** the assignment is refused and the administrator is told the role is not theirs to grant, rather than being shown a generic save failure

#### Scenario: Member deactivated
- **GIVEN** a member being removed from the company
- **WHEN** the removal succeeds
- **THEN** that member can no longer act for the company, and any carts, orders, quotes and quote requests still naming them are listed for explicit handling rather than left as residual access

#### Scenario: Acting user lacks permission
- **GIVEN** an acting user whose roles carry no permission over the company's members
- **WHEN** they open the user management page
- **THEN** access is refused outright, rather than the page rendering with controls that fail only on save

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| User list | `[MIDDLEWARE]` | Identity or account service |
| Role selector options | `[CACHED]` | Config-driven role definitions |
| Invite, edit and deactivate user | `[MIDDLEWARE]` | Write to identity service |
| Spending limits per user | `[MIDDLEWARE]` | Account rule configuration |

## commercetools

**Entities:** `BusinessUnit`, `AssociateRole`, `Customer`, `Store`

**Verified API surface**

- (concept) The Customer is the authentication identity; the Associate is that Customer's membership of one Business Unit together with its AssociateRoleAssignments. One Customer can be an Associate of several Business Units, may hold up to five role assignments in each, and their effective permissions are the sum of those roles with no precedence or override — [docs](https://docs.commercetools.com/api/associates-overview)

**Constraints that change the design**

- For the addAssociate, setAssociates and changeAssociate update actions, the as-associate Business Unit endpoints accept only AssociateRoles whose buyerAssignable property is true; buyerAssignable defaults to true, so a sensitive role has to be set to false deliberately — [docs](https://docs.commercetools.com/api/projects/associate-business-units)
- Removing an Associate from a Business Unit does not revoke their access to the Carts, Orders, Quotes and Quote Requests already associated with it - the Associate has to be removed from each of those entities as well before deactivation is actually complete — [docs](https://docs.commercetools.com/api/associates-overview)
- The My Business Units API cannot assign new Associates, change a Business Unit's status or manage its Stores. A buyer administrator adds a member through POST /{projectKey}/in-business-unit/key={businessUnitKey}/me/customers, which requires the UpdateAssociates Permission, or through the as-associate Business Unit endpoints from a trusted server tier — [docs](https://docs.commercetools.com/api/projects/me-business-units)
- commercetools ships no predefined Associate Roles - the seller creates every role from the Permission enum, through the API or the Merchant Center - so the role selector's options are project configuration rather than platform defaults, and a role has to exist before it can be assigned — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-associate-access/associate-roles-and-permissions)
- Associates inherited from a parent Business Unit appear in inheritedAssociates and are eventually consistent, and inheritance needs both associateMode ExplicitAndFromParent on the child and inheritance Enabled on the parent's role assignment - so a member added at the company may be absent from a division's list for a while, and absent permanently if either setting is missing — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-associate-access/inheritance-modes)
- There is no per-user spending-limit field. Spending authority is expressed as an Approval Rule whose predicate tests the Order and whose requesters name Associate Roles, so a limit is a property of a role and a rule rather than of a person, and budget enforcement proper sits across an integration boundary — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-approval-workflows/why-procurement-governance-matters)

**Modeling notes**

Provision in order - Associate Role, then Customer, then addAssociate with role assignments - because the API and the Merchant Center both block the assignment step until the role exists. Build the user list from the Business Unit's own associates plus inheritedAssociates, and label inherited entries as such: an administrator who cannot tell the difference will try to edit a role assignment that belongs to the parent unit. Keep requesting and approving permissions in separate roles; the platform does not enforce separation of duties, the rule shape only implies it.

## commercetools skills

Load `commercetools-storefront` before implementing this capability. Supporting: `commercetools-platform`, `commercetools-commerce-patterns`. Any task generated from this spec carries `[SKILL: commercetools-storefront]`.

## Open questions

- Where do per-user spending limits actually live? A limit per person has no home in the platform; it can be approximated with one role and one approval rule per spend band, which multiplies roles quickly. Confirm the buyer accepts band granularity before designing around it.
- There is no pending-invite resource - a member either exists as a Customer and Associate or does not. Decide whether the middleware owns invite tokens, expiry and re-send, and what an unaccepted invite looks like in the user list.
- Does deactivating a member mean removeAssociate, or assigning a role with no permissions? Removal is cleaner but loses the record of who they were on resources that only reference the association.
- Which permission gates the page itself? UpdateAssociates governs the write, but the me endpoints do not validate View permissions, so read access has to be gated in the middleware.

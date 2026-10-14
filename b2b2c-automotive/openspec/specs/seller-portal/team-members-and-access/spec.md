<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Managing team members and access

## Purpose

Purchasing authority is the control B2B customers care most about, and it is the one a seller cannot administer on their behalf at scale. A permission model that is approximated in the storefront rather than enforced by the platform will eventually let someone buy something they were not entitled to buy.

## Requirements

### Requirement: Managing team members and access

The storefront SHALL let a company administrator grant each team member exactly the purchasing authority that member should have, and revoke it, without the seller's involvement.

#### Scenario: Member invited with a role
- **GIVEN** a company administrator
- **WHEN** a new member is invited and assigned a role
- **THEN** the member can do exactly what that role permits and nothing else

#### Scenario: Permission refused server side
- **GIVEN** a member whose role lacks a permission
- **WHEN** the member attempts the corresponding action
- **THEN** the platform refuses it, and the storefront reports the refusal rather than having prevented it only in the UI

#### Scenario: Member deactivated
- **GIVEN** a member who has left the company
- **WHEN** the administrator deactivates them
- **THEN** the member can no longer act for the company, and their existing orders remain attributed to them

#### Scenario: Shared resource visibility
- **GIVEN** two members of the same company
- **WHEN** one creates a shopping list or cart
- **THEN** whether the other can see it follows the role's own-versus-others permissions, not resource ownership alone

## Pages

- [Company user and role administration](../user-and-role-management/spec.md)
- [Order approval rules and the approver queue](../approval-workflows/spec.md)
- [Budget monitoring against committed order spend](../budget-and-spending-limits/spec.md)
- [Cost center codes assignable to a purchase](../cost-center-management/spec.md)
- [Error pages that name the failure and route the buyer back](../error-pages/spec.md)

## commercetools

**Entities:** `BusinessUnit`, `Associate`, `AssociateRole`, `AssociateRoleAssignment`, `Customer`

**Verified API surface**

- (concept) An AssociateRole is created and managed by the seller and defines granular Permissions; it is assigned to an Associate in a Business Unit through an AssociateRoleAssignment — [docs](https://docs.commercetools.com/api/projects/associate-roles)
- (concept) Permission names encode the action and the resource, for example CreateMyCarts, and provide controlled access to B2B resources — [docs](https://docs.commercetools.com/api/projects/associate-roles)

**Constraints that change the design**

- Permissions come in My and Others pairs and Others never implies My. Granting ViewOthersShoppingLists without ViewMyShoppingLists produces an associate who can see everyone's lists but not their own — a documented, common support case — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/discover-and-order-products-in-b2b/shopping-lists-for-b2b-purchasing)
- The as-associate endpoints enforce permissions server-side and return 403 Forbidden when the associate's role lacks the matching permission, in addition to the API client needing the corresponding OAuth scope — [docs](https://docs.commercetools.com/api/associates-overview)
- Associates and their roles are inherited down the Business Unit hierarchy, so a role granted at a parent reaches its divisions — [docs](https://docs.commercetools.com/api/associates-overview)

**Modeling notes**

Roles are seller-managed, so the set of roles is a product decision, not per-customer configuration — design the role catalog before onboarding the first company. Always design both halves of each My/Others permission pair. Never reimplement the permission model in the storefront: call as-associate and render the platform's refusal.

## commercetools skills

Load `commercetools-platform` before implementing this capability. Supporting: `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-platform]`.

## Open questions

- Which roles does the business actually need beyond buyer, approver and administrator?
- Are spending limits a role concern, an approval-rule concern, or both?

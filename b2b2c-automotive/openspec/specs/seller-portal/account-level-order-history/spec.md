<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Account-level order history

## Purpose

In a company, the person who needs to see an order is often not the person who placed it. Finance reconciles, managers review departmental spend, and administrators answer for the account — none of which is possible if order history is scoped to the individual who happened to check out.

## Requirements

### Requirement: Account-level order history

The storefront SHALL let an entitled buyer or administrator review the whole company's order history, including orders placed by other team members, filtered by member, cost center, date or status.

#### Scenario: Whole company visible to an administrator
- **GIVEN** a company whose members have each placed orders
- **WHEN** an administrator opens order history
- **THEN** every member's orders are listed, attributed to the member who placed them

#### Scenario: Individual sees only their own
- **GIVEN** a member without company-wide visibility
- **WHEN** that member opens order history
- **THEN** only their own orders are listed, and the platform, not the UI, is what excludes the rest

#### Scenario: Filtered by cost center
- **GIVEN** a company that allocates orders to cost centers
- **WHEN** an administrator filters by one
- **THEN** only orders allocated to that cost center are listed, with their totals

#### Scenario: Division scoped view
- **GIVEN** a company with divisions
- **WHEN** a division administrator opens order history
- **THEN** the view covers that division and what it inherits, not unrelated sibling divisions

## Pages

- [Order history scoped to what the buyer may see](../order-history/spec.md)
- [Session-scoped account dashboard with explicit empty states](../account-dashboard/spec.md)
- [Invoice history and outstanding balance on account](../invoice-and-billing-history/spec.md)

## commercetools

**Entities:** `Order`, `BusinessUnit`, `Associate`, `AssociateRole`, `CustomObject`, `Type`

**Verified API surface**

- (concept) A cost-center reference has no native field and belongs on the resource it describes as a Custom Field on the order or line item; filtering by it is therefore a query over that custom field — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/implement-b2b-purchase-flows/the-b2b-cart)

**Constraints that change the design**

- Orders are company-scoped only when their businessUnit field is set, which happens when they are created through the as-associate and in-business-unit path; an order created outside that context will not appear in a company view — [docs](https://docs.commercetools.com/api/associates-overview)
- Whether an associate sees their own or also others' orders is governed by paired My/Others Associate permissions, and Others never implies My — so a company-wide view still needs the My half to include the viewer's own orders — [docs](https://docs.commercetools.com/api/projects/associate-roles)
- Associates and roles are inherited down the Business Unit hierarchy, so a division administrator's visibility follows the hierarchy rather than a flat company list — [docs](https://docs.commercetools.com/api/associates-overview)

**Modeling notes**

Every order must be created in the as-associate / in-business-unit context or it is invisible to the company forever — this is not repairable later without touching the order. Do not build the visibility rule in the storefront; read the associate's permissions and let the platform scope the query. If cost-center filtering matters, define the custom field before the first order is placed.

## commercetools skills

Load `commercetools-platform` before implementing this capability. Supporting: `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-platform]`.

## Open questions

- Which roles get company-wide order visibility, and is it scoped per division?
- Is cost-center reporting needed in the storefront, or does finance take an export?

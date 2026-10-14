<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Budget monitoring against committed order spend

## Purpose

A budget figure that is maintained independently of the orders it constrains drifts within days, and the first time anyone notices is when an approval is refused for a buyer who believed they had headroom. Because the platform carries no budget resource and evaluates approval predicates against a single order, the remaining-budget number is computed outside and has to be traceable back to the orders that consumed it.

## Requirements

### Requirement: Budget monitoring against committed order spend

The system SHALL report, for every budget an administrator can see, the amount already committed by placed orders in the current period and the amount remaining, derived from the same order records the seller bills against rather than from a separately maintained counter.

#### Scenario: Committed spend reconciles
- **GIVEN** a budget with orders already placed against it in the current period
- **WHEN** an administrator opens the budget overview
- **THEN** spent plus remaining equals the budget total, and the spent figure traces to the individual orders that produced it

#### Scenario: Threshold alert fires once
- **GIVEN** a budget with an alert threshold configured
- **WHEN** a newly placed order takes committed spend across that threshold
- **THEN** the configured recipients are notified once for that crossing and the progress indicator reflects the new state

#### Scenario: Order beyond remaining budget held
- **GIVEN** a buyer whose remaining budget is lower than the total of the order they submit
- **WHEN** they place the order
- **THEN** the order is held for approval rather than proceeding, and the requester is shown the shortfall

#### Scenario: No budgets configured
- **GIVEN** a company that has defined no budgets
- **WHEN** an administrator opens the page
- **THEN** the absence of budgets is stated explicitly with the path to create one, and no zero-valued figures are shown

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Budget overview cards (total, spent, remaining) | `[MIDDLEWARE]` | Account budget + order spend aggregation |
| Spending progress bars | `[MIDDLEWARE]` | Calculated from budget vs. orders |
| Budget list by cost center / user | `[MIDDLEWARE]` | Account configuration |
| Create / edit budget form | `[MIDDLEWARE]` | Write to account service |
| Spending history chart | `[MIDDLEWARE]` | Aggregated order data |
| Alerts configuration | `[MIDDLEWARE]` | Write to notification rules |

## commercetools

**Entities:** `ApprovalRule`, `ApprovalFlow`, `AssociateRole`, `BusinessUnit`, `Cart`, `Order`, `CustomObject`, `Type`

**Verified API surface**

- (concept) An ApprovalRule belongs to one Business Unit and combines a predicate, requester Associate Roles and an approver hierarchy of up to five sequential tiers; only Active rules are evaluated, and a rule that references a field the order does not carry never matches
 — [docs](https://docs.commercetools.com/api/projects/approval-rules)
- (concept) A buyer's credit limit or other organization-wide configuration belongs in a Custom Object; data that describes one cart, order or line item belongs in a Custom Field on that resource
 — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/implement-b2b-purchase-flows/the-b2b-cart)
- (rest) Approval Rules are created and read through /as-associate/{associateId}/in-business-unit/key={businessUnitKey}/approval-rules; managing them requires manage_approval_rules and reading them view_approval_rules
 — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-approval-workflows/approval-rules-predicates-and-requesters)

**Constraints that change the design**

- commercetools has no budget resource and no spend ledger. An Approval Rule predicate is an Order Predicate evaluated against the single order being placed, so a cumulative budget-to-date test cannot be expressed in it - compute the remaining budget outside, carry it on the cart or order as a Custom Field, and gate on custom.<fieldName>
 — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-approval-workflows/approval-rules-predicates-and-requesters)
- Approval governance acts on Orders, not Carts. The platform creates an ApprovalFlow when a placed order matches an active rule, so any budget warning shown during cart building is a storefront concern with no platform enforcement behind it
 — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-approval-workflows/why-procurement-governance-matters)
- A threshold predicate on totalPrice.centAmount alone ignores currency and misfires for a multi-currency buyer; pair it with totalPrice.currencyCode or use the money literal form such as totalPrice > "50000.00 AUD"
 — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-approval-workflows/approval-rules-predicates-and-requesters)
- Approval Rule inheritance is additive: a Division set to ExplicitAndFromParent picks up every parent rule in addition to its own and cannot exempt itself, so a company-wide budget rule cannot be relaxed for one unit - it needs that unit set to Explicit instead
 — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-approval-workflows/approval-rule-inheritance)

**Modeling notes**

Split the page into two responsibilities: budget definition, which is account configuration and can live in Custom Objects keyed by unit and period; and budget consumption, which is an aggregation over placed orders and belongs wherever order history is already queried. Enforcement is a third thing again - an Approval Rule whose predicate reads a Custom Field the middleware stamps on the cart with the remaining budget at the moment of submission. Keep the stamped value and the displayed value from the same computation, or the buyer sees one number and the rule uses another.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-storefront`, `commercetools-connect`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Which system owns the budget period and the committed-spend figure - commercetools order data, or the finance system that also issues invoices?
- Does a budget bind to a cost center, a business unit, or an individual associate, and what happens to in-flight approvals when a budget is edited mid-period?
- Do quotes, recurring orders and orders awaiting approval count against committed spend, or only orders in a placed state?

<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Order approval

## Purpose

Spend controls are the reason many companies can buy online at all. An approval that is invisible to the requester looks like a broken checkout, and one that is invisible to the approver stalls; both failures are experienced as the storefront losing the order.

## Requirements

### Requirement: Order approval

The storefront SHALL route an order that meets its company's approval conditions to an approver before it is placed, and show both the requester and the approver where that order stands.

#### Scenario: Threshold triggers approval
- **GIVEN** a company with an approval rule and a buyer whose basket meets it
- **WHEN** the buyer submits the order
- **THEN** the order is held for approval, the buyer is told so at submission, and no fulfillment begins

#### Scenario: Approver sees the queue
- **GIVEN** an approver with pending requests
- **WHEN** the approver opens their queue
- **THEN** each request shows what is being bought, by whom, and what rule caught it

#### Scenario: Rejected
- **GIVEN** a held order
- **WHEN** the approver rejects it
- **THEN** the requester is told, with the reason, and the order does not proceed

#### Scenario: Below threshold passes straight through
- **GIVEN** a basket that matches no approval rule
- **WHEN** the buyer submits it
- **THEN** the order is placed directly, with no approval step and no approval messaging

#### Scenario: Rule changes mid flight
- **GIVEN** an order already awaiting approval
- **WHEN** the company's approval rules change
- **THEN** the in-flight approval resolves against the rules that applied when it was raised, not the new ones

## Pages

- [Cart with engine-calculated totals after every change](../cart-page/spec.md)
- [Checkout re-reading totals after each shipping change](../checkout-page/spec.md)
- [Order confirmation stating reference and true order state](../order-confirmation-page/spec.md)
- [Session-scoped account dashboard with explicit empty states](../account-dashboard/spec.md)
- [Order approval rules and the approver queue](../approval-workflows/spec.md)
- [Budget monitoring against committed order spend](../budget-and-spending-limits/spec.md)

## commercetools

**Entities:** `ApprovalRule`, `ApprovalFlow`, `Order`, `BusinessUnit`, `Associate`, `AssociateRole`

**Verified API surface**

- (concept) An ApprovalRule states the conditions, as a predicate over the Order, under which an order matching it needs approval before a requester in a Business Unit can place it — [docs](https://docs.commercetools.com/api/projects/approval-rules)
- (concept) An ApprovalFlow matches Approval Rules to Orders and manages the approval state, including whether the order is approved and the status of each approver — [docs](https://docs.commercetools.com/api/associates-overview)

**Constraints that change the design**

- Approval is a platform-enforced gate on order placement within a Business Unit, not a storefront convention — so the storefront must read the resulting flow state rather than deciding approval itself — [docs](https://docs.commercetools.com/api/projects/approval-rules)
- Who may approve is an Associate permission on the Business Unit, so approver assignment and role design are the same decision — [docs](https://docs.commercetools.com/api/projects/associate-roles)

**Modeling notes**

Write approval rules as predicates over the order and keep them few and legible — a rule set nobody can reason about produces orders stuck in approval, which is worse than no approval. Model the requester's and approver's views from the ApprovalFlow rather than inferring status from order state. Punch-out procurement, where an external system initiates the purchase, combines Product Selections, as-associate carts and Approval Flows through middleware; there is no built-in connector for it.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Who defines approval rules — the company's admin in the storefront, or the seller?
- Is multi-step or multi-approver escalation required?

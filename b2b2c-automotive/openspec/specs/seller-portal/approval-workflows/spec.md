<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Order approval rules and the approver queue

## Purpose

Approval authority belongs to roles, not to people, and which roles can act changes as each tier of the flow closes. A queue that lists every pending order to everyone either exposes the whole company's spend or produces actions that fail after the approver has committed to them. Stating the requirement at the decision rather than at the queue makes it testable: an ineligible buyer's action has to fail even when the queue wrongly offered it, which is the only version of this control that survives a frontend bug.

## Requirements

### Requirement: Order approval rules and the approver queue

The system SHALL accept an approve or reject decision on an order awaiting approval only from a buyer holding one of the approver roles that order's approval flow currently requires.

#### Scenario: Eligible approver acts
- **GIVEN** an order whose approval flow names the buyer's role in its currently open tier
- **WHEN** that buyer approves
- **THEN** the approval is recorded against them with a timestamp and the flow either opens the next tier or completes

#### Scenario: Ineligible approver refused
- **GIVEN** a buyer whose roles appear nowhere in the flow's eligible approvers
- **WHEN** they submit an approval
- **THEN** the platform refuses the action, whatever the queue displayed to them

#### Scenario: Two approvers act at once
- **GIVEN** two approvers who opened the same pending approval at the same version
- **WHEN** the second one submits after the first has landed
- **THEN** their action is refused as based on a stale version and they are shown the decision that landed first, not a generic error

#### Scenario: Single rejection is final
- **GIVEN** an approval flow where the first tier has already approved
- **WHEN** any eligible approver rejects
- **THEN** the whole flow is rejected with the reason recorded, and no later approval revives it

#### Scenario: Rule paused not deleted
- **GIVEN** a policy the company wants to suspend for a quarter
- **WHEN** the administrator sets the rule inactive
- **THEN** new orders stop matching it while the rule and its history remain readable

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Rule list | `[MIDDLEWARE]` | Account's approval rule records |
| Create and edit rule form | `[MIDDLEWARE]` | Write to approval service |
| Approver assignment options | `[MIDDLEWARE]` | Account user list |
| Pending approvals queue | `[MIDDLEWARE]` | Real-time queue from order service |
| Approve and reject actions | `[MIDDLEWARE]` | Write to order and notification service |
| Approval history log | `[MIDDLEWARE]` | Audit log query |

## commercetools

**Entities:** `ApprovalRule`, `ApprovalFlow`, `AssociateRole`, `BusinessUnit`, `Order`, `Subscription`, `Message`

**Verified API surface**

- (concept) An ApprovalRule's approvers field is an ApproverHierarchy of tiers; each tier is an ApproverConjunction of ApproverDisjunctions over approver roles, giving AND of OR semantics. Tiers are sequential, a rule supports up to five of them, and a higher tier approving early automatically approves all lower tiers — [docs](https://docs.commercetools.com/api/associates-overview)
- (update-action) approve and reject are the ApprovalFlow update actions, reject taking an optional reason. ApprovalFlowStatus is Pending, Approved or Rejected; Approved is set automatically once every required role across all tiers has approved, and a single rejection sets the whole flow Rejected — [docs](https://docs.commercetools.com/api/projects/approval-flows)
- (concept) The approval history sits on the flow itself: approvals carries an approver and approvedAt per approval, and rejection carries rejecter, rejectedAt and an optional reason, alongside eligibleApprovers, pendingApprovers and currentTierPendingApprovers — [docs](https://docs.commercetools.com/api/projects/approval-flows)

**Constraints that change the design**

- Both requesters and approvers on an ApprovalRule are AssociateRole references - RuleRequester and RuleApprover each require an associateRole and carry no customer field - so approval authority cannot be bound to a named individual and survives staff changes by design — [docs](https://docs.commercetools.com/api/projects/approval-rules)
- Approval governance evaluates Orders, not Carts: the rule's predicate is an Order Predicate and the platform creates the ApprovalFlow at the moment an Order is placed and matches an active rule - so a requester discovers the approval requirement after submitting, not while still in the cart — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-approval-workflows/why-procurement-governance-matters)
- A threshold predicate has to constrain currency - either the money form totalPrice > "50000.00 AUD" or totalPrice.centAmount paired with totalPrice.currencyCode. A bare centAmount comparison matches the same integer in every currency, so it either demands approval where it should not or lets a large order through — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-approval-workflows/approval-rules-predicates-and-requesters)
- Approve and reject are read-then-write on the flow's version; if another approver acted first the update fails with 409 ConcurrentModification, which is handled by re-reading the flow and reassessing rather than by retrying — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-approval-workflows/approval-flows-in-action)
- The platform sends no approval notifications. Subscribe to ApprovalFlow Messages such as ApprovalFlowCreated, then resolve currentTierPendingApprovers to the Associates holding those roles and notify them through your own channel; the frontend gates on eligibleApprovers but the platform is what enforces eligibility — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-approval-workflows/approval-flows-in-action)
- Writing Approval Rules needs the manage_approval_rules scope and reading them view_approval_rules, while acting on a flow needs manage_approval_flows; only a high-authority role should hold manage_approval_rules, since it is the power to rewrite the company's own spending controls — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-approval-workflows/approval-rules-predicates-and-requesters)

**Modeling notes**

Keep requester and approver role sets disjoint for any spend that needs a second pair of eyes - the platform does not enforce separation of duties, the rule's shape only implies it. Only Active rules are evaluated, so deactivate rather than delete when a policy is being paused. A category-based or cost-center-based rule has no native field to test, so tag the Cart or Order with a Custom Field and reference it as custom.<fieldName> in the predicate, keeping the field definition and the predicate in step: a predicate naming a field the Order does not carry never matches, and never matching looks exactly like no policy at all.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-storefront`, `commercetools-connect`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- The source's approver picker is an account user list, but commercetools binds approvers to Associate Roles and offers no way to name an individual. Confirm the buyer accepts role-level approver assignment, or scope a role-per-named-approver shim and price the role sprawl it causes.
- Approval is evaluated on the Order, so a requester only learns their order needs approval after placing it. Does the buyer need a pre-submission warning, and if so what recomputes the predicate against the cart, given the predicate language targets Orders?
- Which permission lets a buyer administrator create and edit rules from the portal at all? manage_approval_rules is an OAuth scope rather than an Associate Permission, so the gate has to be built in the middleware - decide what it checks.
- Should the history log show only the flow's own approvals and rejection, or a fuller audit assembled from messages? The flow records the outcome but not the intermediate views of who was pending when.

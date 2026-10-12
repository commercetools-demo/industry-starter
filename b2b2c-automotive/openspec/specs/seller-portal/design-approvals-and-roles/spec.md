<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

<!-- OUT-OF-SCOPE -->

# Approvals and roles & permissions

> **Out of scope (owner, 2026-10-12).** Order approvals belong to wholesale buying from Malva, which is not built (Q-V01). The portal has two roles, Admin and Buyer; the Approver role, approval tiers and the Roles & permissions page are not built. No workstream implements this spec; `plans/verify-plan.mjs` skips it because of the marker line above. Kept for reference only.

## Purpose

Large purchases need sign-off by the right role, in order. Role permissions decide what each person sees and can do, and the interface must say why when it refuses.

Design source: `Malva Seller Portal.dc.html`, pages `approvals` and `roles`.

## Requirements

### Requirement: Approval queue by tier

The system SHALL list orders pending approval with number, PO, requester and their role, reason ("Matches 'Orders over €10,000'"), total, status chip and a tier chain ("Tier 1 Purchasing Manager — Open", "Tier 2 Finance Director — Waiting").

#### Scenario: Only the open tier can act
- **GIVEN** an order whose open tier is Finance Director and a user who is a Purchasing Manager
- **WHEN** the card renders
- **THEN** Approve and Reject are disabled at reduced opacity with "Your role isn't in the open tier (Finance Director). The platform would refuse this."

#### Scenario: Approve
- **GIVEN** an open tier matching the user's role
- **WHEN** Approve is pressed
- **THEN** that tier shows Approved, the next tier opens, and the order is released after the last tier

#### Scenario: Reject
- **GIVEN** a pending order
- **WHEN** Reject is pressed (with a reason)
- **THEN** the order shows Rejected, remaining tiers show Rejected and the requester is notified

### Requirement: Approval rules

The system SHALL list rules with name, condition (for example "Order total > 10,000.00 EUR · Requesters: Buyer, Branch Buyer" or "custom.costCenter = CC-FLEET"), chain by role, and an Active/Paused toggle, noting that paused rules stop matching new orders but remain readable and that approvers are assigned by role, not person.

#### Scenario: Pause
- **GIVEN** an active rule
- **WHEN** paused
- **THEN** new orders no longer match it, and orders already in flight continue

### Requirement: Approval history

The system SHALL list decisions with order, result, decider and time.

#### Scenario: Reason shown
- **GIVEN** a rejection with a reason
- **WHEN** history renders
- **THEN** the reason is shown

### Requirement: Rule editor (later phase)

The system SHALL provide a rule editor (conditions on total, cost centre, requester role, category; chain of tiers with roles) with a plain-language summary and a test against a sample order.

#### Scenario: Test
- **GIVEN** a rule "total > 10,000"
- **WHEN** tested on a €12,000 sample
- **THEN** it reports the rule matches and lists the tiers it would create

### Requirement: Roles matrix and preview as role

The system SHALL show a permission matrix (Admin, Buyer, Approver by permission group: Business unit, Carts, Orders, Quotes, Approvals, Shopping lists) and a "Preview the portal as a role" selector that disables unavailable actions with "Insufficient permissions to perform this task" and hides menu items the role cannot act on.

#### Scenario: Preview
- **GIVEN** the preview set to Buyer
- **WHEN** "Edit approval rules" is tried
- **THEN** it is disabled with the reason

### Requirement: Custom roles (later phase)

The system SHALL allow custom roles composed of permission groups and assign them per user per business unit.

#### Scenario: Assign
- **GIVEN** a user in two divisions
- **WHEN** roles are set per division
- **THEN** the portal respects the role of the active division

## Gaps

- Rule editor, custom role editor, delegation (out-of-office approvers), escalation timeouts and approval comments are not designed.
- Roles shown are examples (Admin, Buyer, Approver); real role names must be agreed.

## Platform notes

Associate roles, permissions, approval rules and flows (tiers) per `commercetools-commerce-patterns` (custom associate roles, approval rules). Approval is evaluated when the order is created.

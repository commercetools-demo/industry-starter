<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Session-scoped account dashboard with explicit empty states

## Purpose

The dashboard owns no data of its own: it is a fan-out over order, approval, list and finance queries that are all session-specific, so a cached or wrongly scoped panel shows one buyer another buyer's business. An omitted panel is equally damaging in the other direction, because a buyer cannot tell "nothing is waiting for you" from "this failed to load" and stops trusting the page.

## Requirements

### Requirement: Session-scoped account dashboard with explicit empty states

The system SHALL resolve every dashboard summary from the signed-in buyer's own identity and organization scope at request time, and state when a summary is empty rather than omitting it.

#### Scenario: Nothing yet on the account
- **GIVEN** a newly activated buyer with no orders, lists or approvals
- **WHEN** the dashboard loads
- **THEN** every summary renders with an explicit nothing-here state and none is hidden

#### Scenario: One backing service down
- **GIVEN** one of the systems behind a panel is unreachable
- **WHEN** the dashboard loads
- **THEN** that panel reports itself unavailable and every other panel still renders its own data

#### Scenario: Session no longer valid
- **GIVEN** a buyer whose session has expired
- **WHEN** the dashboard is requested
- **THEN** no account data is rendered and the buyer is sent to sign-in with the dashboard preserved as the destination

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Welcome message with user or company name | `[MIDDLEWARE]` | Session identity |
| Open orders count | `[MIDDLEWARE]` | Real-time order query |
| Recent orders widget | `[MIDDLEWARE]` | Last N orders from the account |
| Saved lists preview | `[MIDDLEWARE]` | The account's requisition lists |
| Notifications and alerts banner | `[MIDDLEWARE]` | Account-specific alerts |

## Design

Reference: `design/specs/account.md`, `design/specs/broadband-label.md`.

Layout: title strip "Hi, {firstName}" → summary row (account email and number, monthly bill with next-bill date, honey "Want to change something?" card with Browse plans and Log out) → "Current contract" table (Item, Type, Started, Term, Price; scrolls horizontally below 640px) → "Your plans" grid of Broadband Facts labels.

Design-to-spec mapping and deviations:

- The monthly bill and contract rows describe subscriptions already purchased; the data comes from orders (and recurring/subscription data per `subscriptions-and-recurring-orders`), never from the bundle.
- Absent from the design: order history, address book, payment methods, profile edit, and empty/error states. Empty state needs a design before build.
- The prototype's account number, next bill date and contract rows are fixtures.

## commercetools

**Entities:** `Customer`, `Order`, `ApprovalFlow`, `ShoppingList`, `BusinessUnit`, `AssociateRole`

**Verified API surface**

- (rest) GET /{projectKey}/as-associate/{associateId}/in-business-unit/key={businessUnitKey}/approval-flows returns the unit's Approval Flows; gate an awaiting-me count on currentTierPendingApprovers (roles needed in the open tier) and action eligibility on eligibleApprovers — [docs](https://docs.commercetools.com/api/projects/approval-flows)
- (rest) GET /{projectKey}/me/shopping-lists is scoped to the authenticated Customer and exposes only a subset of ShoppingList fields, so a preview widget can read it directly while curation of shared lists cannot — [docs](https://docs.commercetools.com/api/projects/me-shoppingLists)

**Constraints that change the design**

- The me endpoints resolve everything from the token's customer and do not evaluate View Permissions at all, so a buyer sees their own carts, orders and lists regardless of role; any company-wide figure has to come from the as-associate endpoints instead — [docs](https://docs.commercetools.com/api/associates-overview)
- The platform sends no approval notifications of any kind, so an alerts banner has to be driven from Approval Flow Messages through a Subscription rather than expected from the API — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-approval-workflows/approval-flows-in-action)

**Modeling notes**

Treat each panel as an independent query with its own timeout and its own failure state, because the slowest integration otherwise sets the page's latency. commercetools carries an Order's paymentState, but the invoice document and the outstanding balance come from the finance system, so that panel is on a different reliability budget from the rest of the page.

## commercetools skills

Load `commercetools-storefront` before implementing this capability. Supporting: `commercetools-commerce-patterns`, `commercetools-connect`. Any task generated from this spec carries `[SKILL: commercetools-storefront]`.

## Open questions

- Who owns the outstanding balance figure, and can it be read inside the dashboard's latency budget or must it be cached with a staleness marker?
- Is the approvals count scoped to the buyer's own organization only, or to every organization they are a member of?

---

_Excluded for B2C: Pending approvals count; Outstanding invoices summary; Pending approvals widget; Quick order shortcut._

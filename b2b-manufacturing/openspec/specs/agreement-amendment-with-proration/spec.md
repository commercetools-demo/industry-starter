<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Amending a live agreement, with the part-period charge shown

## Purpose

A service agreement changes far more often than it is signed: a site opens, a volume grows, a program is upgraded. Each of those is currently a phone call that becomes a paper trail, and the buyer's real question is never answered until the invoice arrives — what does this change cost me between now and the next billing date. Showing that number at the point of decision is what makes self-service amendment worth building. It also has to be assembled and submitted as one artefact, because a buyer opening three sites and upgrading a tier has made one commercial decision, and approving it in four pieces produces four different effective dates.

## Requirements

### Requirement: Amending a live agreement, with the part-period charge shown

The system SHALL let an entitled buyer assemble changes to a live agreement — quantities, cadence, sites or tier — and show the resulting recurring charge together with the charge for the remainder of the current period before the amendment is submitted for approval.

#### Scenario: Part period charge shown
- **GIVEN** a live agreement being amended part-way through a billing period
- **WHEN** the buyer reviews the change
- **THEN** the new recurring charge and the charge for the remainder of the current period are both shown before submission

#### Scenario: Several changes one amendment
- **GIVEN** a buyer adding a site and upgrading the tier at the same time
- **WHEN** they submit
- **THEN** both changes are carried as one amendment with one effective date, rather than as separate submissions

#### Scenario: Changes bounded by the terms
- **GIVEN** an agreement whose terms do not permit reducing the committed volume mid-term
- **WHEN** the buyer attempts that change
- **THEN** it is not offered, and an amendment naming it is refused with the term that prevents it

#### Scenario: Before and after per site
- **GIVEN** an amendment affecting two of the buyer's sites differently
- **WHEN** the buyer reviews it
- **THEN** each site's current and resulting configuration and charge are shown separately

#### Scenario: Amendment awaits approval
- **GIVEN** a submitted amendment requiring approval downstream
- **WHEN** the buyer views the agreement
- **THEN** the agreement still shows its current terms with the amendment identified as pending, rather than the new terms appearing as if already in force

#### Scenario: Amendment declined
- **GIVEN** an amendment declined downstream
- **WHEN** the outcome returns
- **THEN** the agreement is unchanged, the buyer is told it was declined, and no part-period charge is raised

#### Scenario: Pricing basis stated
- **GIVEN** a part-period charge computed for an amendment
- **WHEN** the buyer reviews it
- **THEN** the basis of the calculation is stated, so the figure can be checked rather than merely accepted

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| The live agreement pre-loaded | `[MIDDLEWARE]` | Read from the system of record; nothing re-entered by the buyer |
| Changes the agreement permits | `[MIDDLEWARE]` | Bounded by the terms, not an open edit of the contract |
| Several change types assembled as one amendment | `[MIDDLEWARE]` | One decision, one submission, one effective date |
| Resulting recurring charge | `[MIDDLEWARE]` | What the agreement will cost from the next period |
| Charge for the remainder of the current period | `[MIDDLEWARE]` | The part-period amount, computed on a stated basis |
| Before-and-after per site | `[MIDDLEWARE]` | What each site was, and will be |
| Amendment submitted and its state tracked | `[MIDDLEWARE]` | Approval and contracting are owned downstream |
| Trail back to the original agreement | `[MIDDLEWARE]` | Every amendment traceable to what it changed |

## commercetools

**Entities:** `RecurringOrder`, `RecurrencePolicy`, `Cart`, `CustomLineItem`, `Order`, `OrderEdit`, `Type`, `BusinessUnit`

**Verified API surface**

- (concept) A Recurring Order defines the schedule and configuration for automatically creating and placing future Orders at regular intervals, which is the resource an amendment to a live recurring arrangement acts on — [docs](https://docs.commercetools.com/api/recurring-orders-overview)
- (concept) addCustomLineItem charges for something not represented as a Product Variant, which is how a computed part-period amount enters as a one-off line the buyer can inspect alongside the new recurring figure — [docs](https://docs.commercetools.com/learning-implement-carts-and-shopping-lists/implement-carts/update-carts)
- (concept) Subscriptions send notifications to a message queue when a resource is modified and are used to trigger asynchronous background processes, which is how a submitted amendment reaches the approval and contracting systems and how their outcome returns — [docs](https://docs.commercetools.com/api/projects/subscriptions)

**Constraints that change the design**

- commercetools has no proration mechanism and no part-period pricing: the amount for the remainder of a billing period is computed outside the platform and carried as an explicit charge, because nothing in price selection divides a recurring price by elapsed time — [docs](https://docs.commercetools.com/api/recurring-orders-overview)
- If Embedded or Standalone Prices have changed since an Order was created, editing the Order applies the updated prices to all Line Items even when the edit does not touch them, and Line Items with no matching price are removed during the edit — so an Order Edit is not a safe way to express a bounded amendment — [docs](https://docs.commercetools.com/api/projects/order-edits)
- Approval Rules are inherited by Divisions from parent Business Units according to the approval rule mode, so an amendment raised at a site may require approval configured at the company above it — [docs](https://docs.commercetools.com/api/projects/business-units)

**Modeling notes**

Treat the amendment as its own artefact — a cart or a purpose-built record that references the live agreement — and not as an edit of the thing being amended. Two reasons. First, the amendment is pending until something downstream approves it, and an agreement mutated optimistically shows terms that are not in force. Second, Order Edits reprice every line from current prices and drop lines whose price no longer resolves, so using one to express "add a site" can silently change everything else about the arrangement. Proration has no platform support at all: compute the part-period amount yourself, on a basis you write down, and carry it as a Custom Line Item so the buyer sees a figure rather than a promise. The basis is the thing to settle early — whole days, elapsed service visits, or calendar fraction all give different numbers and all look defensible until two of them are implemented in different places.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-connect`, `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- On what basis is the part-period amount computed — whole days, service events, or calendar fraction — and who owns that rule?
- Which changes may a buyer make without approval, and which always require it?
- What is the effective date of an approved amendment: submission, approval, or the next period?
- When an amendment is pending, may the buyer submit a second one?

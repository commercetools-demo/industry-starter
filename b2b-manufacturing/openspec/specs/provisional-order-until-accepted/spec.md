<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# An order recorded as provisional until the owning system accepts

## Purpose

In this industry the commerce platform is very often a capture surface: the sales process, the contract and the fulfillment all belong to systems that were there first and will outlive the storefront. Those systems can and do reject what the storefront accepted — credit, stock, contract cover, a site that is not yet set up. A storefront that says "order confirmed" at submission has made a promise on behalf of a system that has not yet agreed, and every such order becomes a phone call. Saying "received, awaiting acceptance" costs nothing and is true.

## Requirements

### Requirement: An order recorded as provisional until the owning system accepts

Where the order lifecycle is owned by a downstream system of record, the system SHALL record a submitted order as provisional and present it as awaiting acceptance until that system confirms it, rather than presenting submission as acceptance.

#### Scenario: Submission is not acceptance
- **GIVEN** an order whose lifecycle is owned downstream
- **WHEN** the buyer submits it
- **THEN** it is recorded and presented as received and awaiting acceptance, with a quotable reference, and is not described as confirmed

#### Scenario: Acceptance returns
- **GIVEN** a provisional order
- **WHEN** the owning system accepts it and returns its own identifier
- **THEN** the order moves to accepted, both references are recorded against it, and the buyer sees the change

#### Scenario: Rejection returns with a reason
- **GIVEN** a provisional order the owning system rejects
- **WHEN** the rejection returns
- **THEN** the order is marked rejected with the reason, and the buyer is told rather than left with an order that never progresses

#### Scenario: No answer within the window
- **GIVEN** a provisional order for which no acceptance or rejection arrives within the agreed window
- **WHEN** the window expires
- **THEN** the handoff is retried and then escalated to an operator, and the buyer's view still reflects that acceptance is outstanding

#### Scenario: Owning system unavailable at submission
- **GIVEN** the downstream system of record is unreachable when the buyer submits
- **WHEN** submission completes
- **THEN** the order is recorded as provisional and queued for handoff, rather than the submission failing or being reported as accepted

#### Scenario: Duplicate handoff prevented
- **GIVEN** a provisional order whose handoff is retried after an ambiguous failure
- **WHEN** the retry is delivered
- **THEN** the owning system creates one order, not two, because the handoff carries an identifier it can deduplicate on

#### Scenario: Provisional order withdrawn
- **GIVEN** a provisional order not yet accepted
- **WHEN** the buyer withdraws it within the permitted window
- **THEN** the withdrawal is recorded and propagated, and the buyer is told whether it was withdrawn before or after acceptance

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Submission recorded immediately | `[MIDDLEWARE]` | Nothing the buyer entered is lost while acceptance is pending |
| Provisional state visible to the buyer | `[MIDDLEWARE]` | Received and awaiting acceptance, stated plainly |
| Reference the buyer can quote | `[MIDDLEWARE]` | Issued at submission, stable through acceptance |
| Acceptance or rejection returned and applied | `[MIDDLEWARE]` | Inbound from the owning system, with a reason on rejection |
| Identifier assigned downstream recorded | `[MIDDLEWARE]` | The two systems' references tied together |
| Retry and escalation when no answer arrives | `[MIDDLEWARE]` | A silent handoff failure must surface to someone |
| What the buyer may still change while provisional | `[MIDDLEWARE]` | Narrower than a cart, wider than an accepted order |

## commercetools

**Entities:** `Order`, `State`, `Subscription`, `Extension`, `Payment`, `Type`, `Message`

**Verified API surface**

- (concept) States manage the lifecycle and workflows of resources including Orders: the application defines the States, defines which transitions are allowed, and triggers them, so a provisional-until-accepted lifecycle is expressed as a project-defined state machine — [docs](https://docs.commercetools.com/learning-model-your-business-structure/state-machines/state-machines-page)
- (concept) Subscriptions send notifications to a message queue when a resource is modified and are used to trigger asynchronous background processes such as synchronising to a CRM, which is the correct mechanism for a handoff that must survive the downstream system being unavailable — [docs](https://docs.commercetools.com/api/projects/subscriptions)
- (concept) A Subscription notification is delivered as a Message, Change or Event payload, and the Messages carry the resource change — which is what lets a handoff be reconstructed and replayed rather than only reacted to once — [docs](https://docs.commercetools.com/api/projects/subscriptions)

**Constraints that change the design**

- When a Subscription is created, updated or deleted it can take up to one minute for the change to take effect, because Subscription configuration is eventually consistent — [docs](https://docs.commercetools.com/api/projects/subscriptions)
- An API Extension runs before the result is persisted and its failure fails the whole API call, so placing the downstream handoff in an Extension makes order submission depend on the availability of the system of record — commercetools advises using Subscriptions instead when the reaction can be asynchronous — [docs](https://docs.commercetools.com/api/projects/api-extensions)
- Orders created through the Create Order by Import endpoint are not price-validated at creation, and the invalid prices are only detected later when an Order Edit is attempted, at which point the affected Line Items are removed — [docs](https://docs.commercetools.com/api/projects/order-edits)

**Modeling notes**

Model the provisional lifecycle as a custom State machine on the Order and drive the handoff from a Subscription, not an API Extension. The Extension version is tempting because it makes submission synchronous and therefore simple, and it is the wrong choice for exactly that reason: the Extension's failure is the API call's failure, so the system of record being down becomes the storefront being down. With a Subscription the order exists, the buyer has a reference, and the handoff retries. Two things then need designing that nobody designs up front. Delivery is at-least-once, so the downstream call must carry an idempotency key the owning system deduplicates on — a retry after an ambiguous timeout is the normal case, not the exceptional one. And a handoff that never succeeds has to become somebody's problem: without an expiry and an escalation, a provisional order simply sits there, which is worse than a rejection because nobody is told. Note also that Subscription configuration is eventually consistent, so a deployment that creates the Subscription and starts taking orders in the same minute can drop the first ones.

## commercetools skills

Load `commercetools-connect` before implementing this capability. Supporting: `commercetools-commerce-patterns`, `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-connect]`.

## Open questions

- Which system owns the order lifecycle, and what is its committed acceptance window?
- What may a buyer change or withdraw while an order is provisional?
- Is payment authorized at submission or at acceptance, and who carries the exposure in between?
- Who is escalated to when a handoff exceeds its window, and through what channel?

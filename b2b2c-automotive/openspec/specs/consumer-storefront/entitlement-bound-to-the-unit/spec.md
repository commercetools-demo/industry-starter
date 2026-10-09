<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Entitlements that belong to the vehicle, not to whoever bought them

## Purpose

Once capabilities and services are sold against a vehicle, the vehicle starts carrying a bundle of entitlements that has nothing to do with who is holding the keys. Then it is sold, and everything about that bundle becomes a question nobody planned for. The previous keeper is still paying for a service they no longer benefit from. The new keeper switches the car on and finds features they did not buy, which they will assume are included and will complain about the moment they stop. Somewhere a subscription renews against a card belonging to someone who sold the car three months ago. None of these are edge cases in a business that sells both new and used vehicles — it is the same vehicle passing through the same company twice, and the second sale is where the first sale's entitlements come due. The rules differ by entitlement and that is exactly why this has to be explicit: a paid-permanently feature usually should stay with the car, a personal service subscription usually should not, a warranty extension may transfer only if it is registered, and a free trial almost never transfers. Deciding per entitlement is the work; the mistake is having one blanket rule, or none.

## Requirements

### Requirement: Entitlements that belong to the vehicle, not to whoever bought them

The system SHALL resolve every active entitlement attached to a vehicle when that vehicle changes hands, applying each one's own rule for whether it transfers, lapses or must be re-bought by the new keeper.

#### Scenario: Transferring entitlement stays
- **GIVEN** an entitlement whose rule is that it transfers with the vehicle
- **WHEN** the vehicle changes hands
- **THEN** it remains active and the new keeper is told they have it

#### Scenario: Personal entitlement lapses
- **GIVEN** an entitlement whose rule is that it does not transfer
- **WHEN** the vehicle changes hands
- **THEN** it is ended, the new keeper does not receive it, and it is offered to them to buy

#### Scenario: Billing stops for the previous keeper
- **GIVEN** a recurring entitlement billed to the previous keeper
- **WHEN** the vehicle changes hands
- **THEN** no further charge is raised against them for that vehicle

#### Scenario: New keeper told what they have
- **GIVEN** a vehicle carrying a mix of transferring and lapsing entitlements
- **WHEN** the new keeper first signs in
- **THEN** they are shown what they have, what they do not, and what ends when

#### Scenario: Term spans the handover
- **GIVEN** a paid term that runs past the change of keeper
- **WHEN** the handover is processed
- **THEN** the part-period amounts on each side are settled according to the stated rule

#### Scenario: Lapsed entitlement offered back
- **GIVEN** an entitlement that lapsed on handover
- **WHEN** the new keeper browses
- **THEN** it is offered as available to buy for that vehicle

#### Scenario: History without the previous keeper
- **GIVEN** a vehicle with a history of entitlements
- **WHEN** the new keeper views it
- **THEN** they see what the vehicle has carried without seeing who held or paid for it

#### Scenario: Handover not reported
- **GIVEN** a vehicle that changed hands without the platform being told
- **WHEN** the discrepancy is detected
- **THEN** it is raised for resolution rather than left to bill the wrong person indefinitely

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Entitlements held against the vehicle | `[MIDDLEWARE]` | Enumerable for one vehicle at any moment |
| A transfer rule on each entitlement | `[STATIC]` | Transfers, lapses, or must be re-bought |
| Change of keeper as an event the platform reacts to | `[MIDDLEWARE]` | Not discovered when somebody complains |
| Billing stopped for the departing keeper | `[MIDDLEWARE]` | Nobody keeps paying for a car they sold |
| What the new keeper inherits, stated to them | `[MIDDLEWARE]` | Including what will lapse and when |
| Lapsed entitlements offered back for purchase | `[MIDDLEWARE]` | The handover is the best moment to sell them again |
| History retained against the vehicle | `[MIDDLEWARE]` | What it has carried, without exposing who paid |
| Part-period amounts settled on both sides | `[MIDDLEWARE]` | A term that spans the handover belongs to two people |

## commercetools

**Entities:** `Order`, `RecurringOrder`, `RecurrencePolicy`, `Customer`, `CustomObject`, `State`, `Subscription`, `Type`, `Payment`

**Verified API surface**

- (concept) A Recurring Order defines the schedule and configuration for automatically creating and placing future Orders at regular predefined intervals on behalf of a customer, and acts as the base for generating those Orders — [docs](https://docs.commercetools.com/api/recurring-orders-overview)
- (concept) Subscriptions send notifications to a message queue when a resource is modified, which is how a change recorded in commercetools reaches the systems that must act on it — [docs](https://docs.commercetools.com/api/projects/subscriptions)
- (concept) Answering a subject access request means querying Customer, Order, Payment, Custom Object and other resources individually by Customer ID predicate, and merchants are told to review their data model so that no other resource refers to personal data — [docs](https://docs.commercetools.com/api/gdpr)

**Constraints that change the design**

- A Recurring Order is defined on behalf of a customer and a Recurrence Policy expresses only a schedule, so nothing in the recurring model reacts to the thing being subscribed to changing owner — stopping or reassigning it is an action the implementation has to take — [docs](https://docs.commercetools.com/api/recurring-orders-overview)
- Subscriptions fire on resource modification, so a change of keeper only produces an event if something in commercetools is actually written — a handover recorded solely in an external register will never reach the platform — [docs](https://docs.commercetools.com/api/projects/subscriptions)
- Custom Objects store data that does not fit the standard data model and are API-only, so a register of which entitlements a vehicle carries is invisible in the Merchant Center and outside every default retention and reporting assumption unless it is enumerated deliberately — [docs](https://docs.commercetools.com/learning-model-your-business-structure/extensibility/data-model-extensions)

**Modeling notes**

Keep one register of what a vehicle carries, keyed by the vehicle and not by the customer, and make every sellable entitlement declare its transfer rule as data rather than leaving it to code. The rule is a product decision that changes per feature and per market, and hard-coding it guarantees a release every time commercial changes its mind. A Custom Object per vehicle is the natural home; enumerate those containers in your retention and access policies, because they are API-only and will otherwise be missed. Recurring Orders are on behalf of a customer and a Recurrence Policy expresses nothing but a schedule, so nothing stops billing when the car is sold — the handover has to explicitly end or reassign each recurring entitlement, and the failure mode if you skip it is charging someone for a vehicle they no longer own, which is the kind of error that reaches a regulator rather than a support queue. Make the handover a written event in commercetools so a Subscription can fan it out, and accept that the trigger usually originates elsewhere — a handover recorded only in a national register will never produce an event here, so build the reconciliation job as well as the event path. Treat the privacy boundary as part of the design: the vehicle's entitlement history is useful to the new keeper and the previous keeper's identity is not, so separate what the vehicle carried from who paid for it before anyone asks you to.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-connect`, `commercetools-platform`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Which system is authoritative for a change of keeper, and how does it reach commerce?
- What is the default transfer rule when a new entitlement is introduced without one being stated?
- How are part-period amounts settled between the two keepers, and who arbitrates a dispute?
- How long is a vehicle's entitlement history retained, and what of it may a new keeper see?

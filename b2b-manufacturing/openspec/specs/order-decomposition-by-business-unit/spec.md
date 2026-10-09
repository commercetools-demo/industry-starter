<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# One submitted order split to the back office that owns each part

## Purpose

Industrial sellers are assembled from acquisitions and divisions, and each one arrived with its own ERP, its own order management and often its own payment arrangements. The buyer neither knows nor cares: they bought from one seller and expect one transaction. Decomposition is therefore invisible work that has to be exactly right, because the failure modes are the expensive kind — the same order created twice in one system, or created in one and lost in another, with no single record that says which parts landed and which did not.

## Requirements

### Requirement: One submitted order split to the back office that owns each part

The system SHALL decompose one submitted order into the separate orders each owning back office requires, route each to the system that owns it, and keep every resulting record traceable to the single order the buyer placed.

#### Scenario: Split and routed
- **GIVEN** an order whose lines are owned by two different back offices
- **WHEN** it is submitted
- **THEN** one outbound order is produced per owning system, each carrying only its own lines, and each is routed to that system

#### Scenario: Buyer sees one order
- **GIVEN** a decomposed order
- **WHEN** the buyer views their order and confirmation
- **THEN** they see one order with one reference, and no division, back office or routing detail appears

#### Scenario: Amounts reconcile
- **GIVEN** an order split across owning systems
- **WHEN** the attributable amounts are computed
- **THEN** they sum to the total the buyer confirmed, and a mismatch stops the handoff rather than being routed

#### Scenario: One part fails to land
- **GIVEN** a decomposed order where one owning system accepts and another does not answer
- **WHEN** the handoff state is inspected
- **THEN** each part carries its own state, the failing part is retried and escalated, and the buyer's order shows that part as outstanding rather than the whole order as failed

#### Scenario: Retry does not duplicate
- **GIVEN** a part whose delivery failed ambiguously and is retried
- **WHEN** the retry lands
- **THEN** the owning system holds one order for that part, because the handoff carries an identifier it deduplicates on

#### Scenario: New owning system added
- **GIVEN** a further back office introduced by an acquisition
- **WHEN** lines it owns are ordered
- **THEN** they are routed to it without the existing routes changing, because ownership is resolved from data rather than from code paths

#### Scenario: Settlement follows the split
- **GIVEN** two parts settled through different payment arrangements
- **WHEN** settlement is captured
- **THEN** each part's amount is captured through its own arrangement and recorded against the single buyer-facing order

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Owning back office identified per line | `[MIDDLEWARE]` | Derived from the line, not chosen by the buyer |
| Order split along ownership boundaries | `[MIDDLEWARE]` | One outbound order per owning system |
| Amount attributable to each part | `[MIDDLEWARE]` | The split must sum back to what the buyer confirmed |
| Settlement routed to the matching arrangement | `[MIDDLEWARE]` | Each division's own payment path |
| One buyer-facing order and confirmation | `[STATIC]` | The decomposition is never shown to the buyer |
| Trail from each downstream record to the original | `[MIDDLEWARE]` | Both directions, so either end can be reconciled |
| Per-part handoff state | `[MIDDLEWARE]` | One part failing is not the whole order failing |

## commercetools

**Entities:** `Order`, `Store`, `Channel`, `BusinessUnit`, `Subscription`, `State`, `Payment`, `Type`, `Message`

**Verified API surface**

- (concept) Subscriptions send notifications to a message queue when a resource is modified and are used to trigger asynchronous background processes such as synchronising records to an external system, which is the mechanism a decomposition and routing pipeline is driven from — [docs](https://docs.commercetools.com/api/projects/subscriptions)
- (concept) A Subscription notification arrives as a Message, Change or Event payload, and predefined Messages describe the resource change — which is what allows a routing pipeline to be replayed from the message rather than only reacting once — [docs](https://docs.commercetools.com/api/projects/subscriptions)
- (concept) An Order can reference a set of Payments through PaymentInfo, so parts of one order settled through different arrangements are each recorded as their own Payment against the single order — [docs](https://docs.commercetools.com/api/projects/payments)
- (concept) Stores are individual shopping contexts within a Project providing data isolation, and a single Distribution or Supply Channel can be linked to multiple Stores — which is how the division that owns a line is carried as data rather than inferred — [docs](https://docs.commercetools.com/learning-model-your-business-structure/stores-and-channels/manage-multiple-experiences-from-one-project)

**Constraints that change the design**

- An API Extension is limited to applying a maximum of 100 additional updates to the object it extends and runs before the result is persisted, and its failure fails the whole API call — so decomposition and routing do not belong in an Extension — [docs](https://docs.commercetools.com/api/projects/api-extensions)
- commercetools models one Order per checkout and has no order-splitting mechanism: the decomposition exists only in the integration layer, and the platform remains the single buyer-facing order — [docs](https://docs.commercetools.com/api/projects/orders)

**Modeling notes**

Keep one Order in commercetools. The platform has no splitting mechanism and does not need one: the buyer's order is the durable record and the decomposition is a projection of it produced by the integration layer, which means reconciliation always has one authoritative starting point. Resolve ownership from data on the line — the Store or Channel it was sold through — rather than from a routing function full of conditionals, because the reason this capability exists is that the number of owning systems changes. Do not put any of it in an API Extension: it is capped at 100 updates, it is synchronous, and its failure is the checkout's failure. Drive it from a Subscription and give every part its own handoff state on the order, because the interesting case is partial success and a single order-level flag cannot express it. Two invariants are worth asserting in code: the attributable amounts sum to the confirmed total before anything is routed, and every outbound call carries an idempotency key, since at-least-once delivery makes duplicate creation the default failure rather than a rare one.

## commercetools skills

Load `commercetools-connect` before implementing this capability. Supporting: `commercetools-commerce-patterns`, `commercetools-platform`. Any task generated from this spec carries `[SKILL: commercetools-connect]`.

## Open questions

- Which attribute of a line determines its owning back office, and who maintains that mapping?
- When one part is accepted and another rejected, is the accepted part fulfilled or held?
- What is the reconciliation process and its cadence, and who runs it?
- Does each owning system require its own order numbering, and must the buyer ever see it?

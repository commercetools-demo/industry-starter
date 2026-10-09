<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Paying to switch on what the vehicle already physically has

## Purpose

Vehicles now leave the factory carrying hardware their owner has not paid to use, and the commerce question is no longer what to ship but what to switch on. That changes the shape of the transaction in two ways that catch teams out. First, the catalog is not a catalog: an item is only sellable if this particular vehicle has the sensor, the module or the wiring the feature depends on, and the answer differs between two cars of the same model and year depending on how each was specified and what has been retrofitted since. Selling a feature a vehicle cannot run is not a returns problem, it is a refund plus an angry owner who has already told people what their car can now do. Second, fulfillment is a real step that can fail. Taking payment is not delivery; the activation has to reach a vehicle that may be in an underground car park, switched off, or several software versions behind, and it may take days to land. An order marked complete at payment is an order that lies, and the owner's expectation — that they paid and it should work now — makes honesty about the pending state far more valuable here than in a shipment they can track.

## Requirements

### Requirement: Paying to switch on what the vehicle already physically has

The system SHALL offer a software-activated capability only where the identified vehicle's hardware can support it, and treat the sale as fulfilled only once activation on that vehicle has been confirmed.

#### Scenario: Offered only where hardware supports it
- **GIVEN** two vehicles of the same model with different fitted hardware
- **WHEN** each owner browses activatable features
- **THEN** each is offered only what their own vehicle can run

#### Scenario: Unsupported feature explains itself
- **GIVEN** a feature the vehicle's hardware cannot support
- **WHEN** the owner reaches it by any route
- **THEN** it is not purchasable for that vehicle and the reason is given

#### Scenario: Fulfillment waits for the vehicle
- **GIVEN** a paid activation
- **WHEN** the vehicle has not yet confirmed it
- **THEN** the order shows as awaiting activation rather than complete

#### Scenario: Activation confirmed
- **GIVEN** an activation the vehicle has confirmed
- **WHEN** the order is read
- **THEN** it is fulfilled, and the date the capability became live is recorded

#### Scenario: Activation fails
- **GIVEN** an activation that cannot be applied to the vehicle
- **WHEN** the failure is reported
- **THEN** the order is not marked fulfilled and the owner is offered the defined remedy

#### Scenario: Term feature ends on its date
- **GIVEN** a capability bought for a fixed term
- **WHEN** the term ends
- **THEN** the end is on the record from the moment of purchase, and the owner was told the date

#### Scenario: Bought from the vehicle
- **GIVEN** an owner making the purchase from the vehicle itself
- **WHEN** they buy
- **THEN** the vehicle and the owner are both taken from the session rather than asked for

#### Scenario: Retrofit changes what is offered
- **GIVEN** a vehicle whose hardware changes after a retrofit
- **WHEN** the owner next browses
- **THEN** the offer reflects the vehicle as it is now

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Hardware capability resolved for the identified vehicle | `[MIDDLEWARE]` | Per vehicle, not per model or model year |
| Unsupported features withheld with a reason | `[MIDDLEWARE]` | Not shown then refused, and not silently absent |
| The purchase bound to one vehicle | `[MIDDLEWARE]` | Not to the account that paid for it |
| Duration stated at purchase | `[STATIC]` | A term with an end date, or permanent for the vehicle |
| Fulfillment as a confirmed activation | `[MIDDLEWARE]` | Confirmed by the vehicle, not assumed from the payment |
| Pending activation visible to the owner | `[MIDDLEWARE]` | Paid and not yet live is a state worth showing |
| Failed activation treated as unfulfilled | `[MIDDLEWARE]` | With a defined remedy rather than a closed order |

## commercetools

**Entities:** `Product`, `ProductType`, `Order`, `LineItem`, `State`, `Subscription`, `RecurrencePolicy`, `CustomObject`, `Type`, `Extension`

**Verified API surface**

- (concept) Subscriptions send notifications to a message queue of your choice when a resource is modified, and are used to trigger asynchronous background processes such as charging a card after an order has shipped or synchronising to an external system — [docs](https://docs.commercetools.com/api/projects/subscriptions)
- (concept) Beyond the four predefined order states, user-defined States allow any number of States and State Transitions, which is how an order awaiting confirmation from an external system is represented — [docs](https://docs.commercetools.com/learning-model-your-business-structure/state-machines/state-machines-page)
- (concept) A Recurrence Policy defines a schedule on individual Line Items using either a StandardSchedule of daily, weekly or monthly intervals or a DayOfMonthSchedule, and is the mechanism for a capability sold on a recurring term — [docs](https://docs.commercetools.com/api/recurring-orders-overview)

**Constraints that change the design**

- Subscription delivery is at-least-once and the same notification may be sent several times, with retries for up to 48 hours on a temporary error, so the activation trigger must be processed idempotently using resource.id with sequenceNumber or version — [docs](https://docs.commercetools.com/api/projects/subscriptions)
- A maximum of 50 Subscriptions can be created per Project as a soft limit, which bounds a design that adds a Subscription per feature family rather than routing from one — [docs](https://docs.commercetools.com/api/projects/subscriptions)
- commercetools has no vehicle, hardware-capability or feature-activation concept: what a given unit can run is resolved outside the platform, and the eligibility answer is context the implementation carries rather than catalog data the platform filters on — [docs](https://docs.commercetools.com/api/projects/custom-objects)

**Modeling notes**

Resolve capability before you resolve catalog. The vehicle's hardware profile comes from the connected-vehicle backend, not from the product model, and the only sane sequence is to fetch it once per session, reduce it to a set of tokens, and use those to filter what is offered — trying to express hardware dependency as catalog attributes fails as soon as two cars of the same variant differ, which is immediately. Keep the vehicle identity on the order line rather than on the customer: the entitlement belongs to the car, the car outlives the account, and a design that hangs features off the buyer will break the first time one is sold. Make activation a real fulfillment step with its own State. Emit the activation request from an Order Subscription, and write the consumer to be idempotent from the start — delivery is at-least-once with retries over 48 hours, so a naive consumer will attempt the same activation repeatedly, which is harmless for an idempotent activation and expensive for a metered one. Watch the ceiling of fifty Subscriptions per project and route from one rather than adding a Subscription per feature family. Finally, do not let the order complete on payment. The pending window is genuinely long, the owner is genuinely waiting, and the single most valuable thing the storefront can do in this pattern is tell the truth about which of paid, sent and live the purchase has reached.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-connect`, `commercetools-platform`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Which system is authoritative for what a given vehicle's hardware can support, and how fresh must that answer be?
- How long may an activation stay pending before the purchase is reversed, and who decides?
- What is the remedy when activation fails permanently — refund, retrofit quote, or something else?
- Can a capability be bought for a vehicle by someone who is not its registered keeper?

---

_Excluded for B2B2C: Purchase initiated from the vehicle itself._

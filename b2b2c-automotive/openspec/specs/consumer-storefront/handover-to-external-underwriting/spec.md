<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# The journey leaves for a credit decision and comes back

## Purpose

Most vehicles are not paid for, they are financed, and the decision to finance one is made by somebody else. That decision is not a payment step: it is a separate regulated journey, with its own identity checks, its own affordability questions and its own timescales, and it happens in a system the storefront does not control and often cannot style. So the purchase has to be able to leave and come back — and the coming back is the part that gets built badly. A buyer who returns to an empty basket after fifteen minutes of entering income details will not do it twice. Worse, a storefront that treats the return as a simple redirect tends to reconstruct the cart from whatever is in the session and place an order on the assumption that the finance went through, which means orders exist against agreements that were declined or approved on different terms. The outcome is a fact about this purchase and has to be attached to it: approved on these terms, referred, or declined. Referral deserves its own answer rather than being collapsed into failure, because it is common, it resolves in the buyer's favor often enough to matter, and telling somebody they were declined when they were not is a serious thing to get wrong.

## Requirements

### Requirement: The journey leaves for a credit decision and comes back

The system SHALL hand a purchase to an external finance or insurance provider for a decision and resume that same purchase when it returns, binding the outcome to the cart so that the order can only be placed on terms that were actually granted.

#### Scenario: Approved terms bind the order
- **GIVEN** a buyer whose finance application is approved on particular terms
- **WHEN** they return and place the order
- **THEN** the order carries the granted terms and the payment arrangement matches them

#### Scenario: Quoted terms differ from granted
- **GIVEN** an application approved on terms different from those quoted beforehand
- **WHEN** the buyer returns
- **THEN** the difference is shown and the order cannot proceed on the quoted terms

#### Scenario: Declined application
- **GIVEN** a declined application
- **WHEN** the buyer returns
- **THEN** the purchase is not completed on finance, and the alternatives available to them are offered

#### Scenario: Referred application
- **GIVEN** an application that is referred rather than decided
- **WHEN** the buyer returns
- **THEN** it is reported as referred, the purchase is held, and no order is placed either way

#### Scenario: Purchase survives the round trip
- **GIVEN** a buyer who spends a long time in the provider's journey
- **WHEN** they return
- **THEN** the configured unit, its price and the reservation are all still there

#### Scenario: Buyer does not return
- **GIVEN** an application started and never completed
- **WHEN** the hold period elapses
- **THEN** the purchase resolves to a defined state rather than remaining open indefinitely

#### Scenario: No order on an assumed decision
- **GIVEN** a return from the provider with no decision recorded
- **WHEN** order placement is attempted
- **THEN** it is refused rather than proceeding on an assumption

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Which providers are offered resolved from context | `[MIDDLEWARE]` | Market, selling business and the unit itself all narrow it |
| The purchase preserved across the hand-off | `[MIDDLEWARE]` | Survives the time away, and the device being changed |
| A correlation the provider returns with | `[MIDDLEWARE]` | Ties the decision to this purchase and no other |
| Outcome bound to the purchase, not merely displayed | `[MIDDLEWARE]` | Approved terms, referral or decline, recorded against it |
| Approved terms becoming the payment arrangement | `[MIDDLEWARE]` | Deposit, term and installment as granted, not as quoted |
| Referral treated as its own state | `[MIDDLEWARE]` | Neither approval nor decline, and resolvable later |
| Return to where the buyer left | `[MIDDLEWARE]` | Not to the basket and not to the beginning |
| Abandonment handled as a state of its own | `[MIDDLEWARE]` | A buyer who never comes back leaves a resolvable record |

## commercetools

**Entities:** `Cart`, `Order`, `Payment`, `Transaction`, `PaymentInfo`, `State`, `CustomObject`, `Type`, `Extension`

**Verified API surface**

- (concept) Checkout creates a Payment with a Transaction in state Initial, sends the request to the provider, sets the Transaction state to Pending because the request is asynchronous, and updates it to Success or Failure when the provider notifies the outcome — [docs](https://docs.commercetools.com/checkout/payments-lifecycle)
- (concept) Beyond the four predefined order states, user-defined States allow any number of States and State Transitions, which is the mechanism for a purchase that is awaiting an external decision — [docs](https://docs.commercetools.com/learning-model-your-business-structure/state-machines/state-machines-page)
- (concept) An Order or Cart references a set of Payments through PaymentInfo and a Payment holds the provider, the method and its transactions, so a financed purchase records the arrangement alongside any deposit taken separately — [docs](https://docs.commercetools.com/api/projects/payments)

**Constraints that change the design**

- A Transaction has only Initial, Pending, Success and Failure states, so an outcome that is neither approval nor decline — a referral awaiting a human — has no native representation and needs a State or Custom Field of its own — [docs](https://docs.commercetools.com/checkout/payments-lifecycle)
- A maximum of 10000000 Carts can be added to a Project and after that limit the automatic cleanup task deletes Carts based on their retention period, so a Cart left waiting on an external decision is not guaranteed to still be there — [docs](https://docs.commercetools.com/api/projects/carts)
- An API Extension validates a Cart update or Order creation by responding 400 with an errors array, which is where an order attempted without a recorded decision has to be stopped — [docs](https://docs.commercetools.com/guides/extensions)

**Modeling notes**

Promote the purchase out of the cart before the buyer leaves. A cart is the wrong vessel for something that must survive an absence measured in hours or days: carts are subject to automatic cleanup against a retention period, they are tied to a session in practice even when they are not in theory, and nothing outside the storefront can see one. Create an order in a user-defined awaiting-decision State, or a durable record of your own, and make the provider's correlation identifier the key that brings the buyer back to it. Then treat the decision as inbound rather than as something you read on the redirect — the redirect is the buyer's browser and it may never arrive, while the provider's notification is the fact. Take both, reconcile them, and let the notification win. Model referral explicitly. Transaction states are Initial, Pending, Success and Failure, so the state that means a human is looking at it has to be yours, and if you do not create it referral will be coerced into failure by whoever writes the mapping. Bind the granted terms to the order and validate them at order creation in an API Extension: quoted and granted terms differ often enough that treating them as the same is a guaranteed source of orders nobody can fulfill. Finally, decide what happens to the reservation while the buyer is away, because the unit is held, the decision is slow, and those two facts are in direct tension.

## commercetools skills

Load `commercetools-checkout` before implementing this capability. Supporting: `commercetools-connect`, `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-checkout]`.

## Open questions

- How long may a purchase wait on an external decision, and what happens to the reservation meanwhile?
- Which provider is offered for which market, seller and unit, and who maintains that mapping?
- When granted terms differ from quoted terms, may the buyer accept them in the storefront or must they return to the provider?
- Who resolves a referred application, and through which surface does the buyer learn the result?

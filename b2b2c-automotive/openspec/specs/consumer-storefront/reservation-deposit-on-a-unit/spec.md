<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# A refundable deposit that holds one unit off the market

## Purpose

Very few people buy a vehicle outright in a browser. What the online journey actually converts is a commitment — the buyer pays a modest, refundable amount, the unit stops being available to anyone else, and the remainder of the transaction happens with a person, often days later and usually somewhere else. Treating that as a checkout for a fraction of the price misses what the buyer is paying for, which is not part of a car but exclusivity for a period. Two things follow. The hold must be real: the whole value of the deposit evaporates if the unit can still be sold from the showroom floor, so the reservation has to reach every channel, and it has to expire on its own rather than waiting for someone to tidy up. And the money must be traceable through to the end, because a deposit is either credited against a purchase weeks later or returned, and the buyer who paid it is far more sensitive to getting that wrong than they would be about an ordinary refund. Where several businesses in a chain can take the deposit, which of them holds it is not an accounting detail — it decides who owes it back.

## Requirements

### Requirement: A refundable deposit that holds one unit off the market

The system SHALL allow a buyer to secure one identified unit by paying a refundable deposit that removes it from sale for a stated period, with the deposit set against the purchase price if the sale completes and returned if it does not.

#### Scenario: Deposit secures the unit
- **GIVEN** a buyer who pays the deposit on an available unit
- **WHEN** the payment succeeds
- **THEN** the unit is removed from sale, and the buyer is shown the period it is held for

#### Scenario: Terms before payment
- **GIVEN** a buyer about to pay a deposit
- **WHEN** they reach the payment step
- **THEN** the amount, the hold period and the refund terms are stated before they commit

#### Scenario: Hold reaches other channels
- **GIVEN** a unit reserved online
- **WHEN** it is looked up at the point of sale or through any other channel
- **THEN** it shows as reserved rather than available

#### Scenario: Hold expires on its own
- **GIVEN** a reservation whose period ends without the sale completing
- **WHEN** the period elapses
- **THEN** the unit returns to sale and the deposit is handled according to the stated terms

#### Scenario: Deposit credited on completion
- **GIVEN** a reserved unit whose sale completes
- **WHEN** the balance is calculated
- **THEN** the deposit appears as a credit against the price rather than being silently absorbed

#### Scenario: Deposit returned on cancellation
- **GIVEN** a buyer who cancels within the refundable period
- **WHEN** they cancel
- **THEN** the deposit is returned to the instrument that paid it, and the unit returns to sale

#### Scenario: Concurrent deposit attempts
- **GIVEN** two buyers attempting to reserve the same unit at once
- **WHEN** both pay
- **THEN** only one reservation is created and the other payment is not taken

#### Scenario: Receiving party recorded
- **GIVEN** a deposit taken where several businesses could receive it
- **WHEN** the reservation is created
- **THEN** the business holding the deposit is recorded on it

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Deposit as the online conversion point | `[MIDDLEWARE]` | The journey completes on a commitment, not on the full price |
| Amount and refund terms stated before payment | `[STATIC]` | What it costs, what it buys, and when it stops being refundable |
| The unit removed from sale across every channel | `[MIDDLEWARE]` | Including the ones that are not the storefront |
| Hold period stated and visible to the buyer | `[MIDDLEWARE]` | How long they have, counted from when they paid |
| Automatic release when the period ends | `[MIDDLEWARE]` | Expiry is a timer, not a housekeeping task |
| Deposit credited against the balance on completion | `[MIDDLEWARE]` | Visible as a credit, not silently netted off |
| Receiving party recorded on the reservation | `[MIDDLEWARE]` | Which business in the chain holds the money |

## commercetools

**Entities:** `Payment`, `PaymentInfo`, `Transaction`, `Cart`, `Order`, `State`, `InventoryEntry`, `CustomObject`, `Type`

**Verified API surface**

- (concept) During payment capture an authorized amount is deducted from the customer's account and transferred to the merchant, executed automatically where auto capture is configured or triggered manually during processing of an Order — the decision of when to capture is a merchant business decision — [docs](https://docs.commercetools.com/checkout/payments-lifecycle)
- (concept) A refund can be partial or full, cannot exceed the captured amount, and a Payment can be refunded multiple times as long as the total does not exceed the original Payment — [docs](https://docs.commercetools.com/checkout/payments-lifecycle)
- (concept) An Order or a Cart can reference a set of Payments using the PaymentInfo object, and a Payment holds the PSP, the payment method and its related transactions — [docs](https://docs.commercetools.com/api/projects/payments)

**Constraints that change the design**

- On a successful authorization the amount is reserved and not deducted, and the payment is put on hold for a specific period of time typically between a few days and a week; if the timeframe elapses without capture the authorization expires and the reserved funds are released — [docs](https://docs.commercetools.com/checkout/payments-lifecycle)
- Reservations are guaranteed regardless of the eventual consistency delay because reservation logic acquires stock from an internal real-time availability collection, which is what makes a single-unit hold safe under concurrent attempts — [docs](https://docs.commercetools.com/api/inventory-overview)
- commercetools has no reservation, deposit or hold-period resource: there are four predefined order states and user-defined States with any number of transitions, so a reservation is an Order in a State you define plus a timer you run, and nothing in the platform expires it for you — [docs](https://docs.commercetools.com/learning-model-your-business-structure/state-machines/state-machines-page)

**Modeling notes**

Model the reservation as a real Order in a State of your own — reserved, then either converted or released — rather than as a long-lived cart. An order gives you the payment relationship, the audit trail and something the rest of the business can see; a cart that is meant to be a commitment is invisible to everybody outside the storefront. Capture the deposit rather than holding an authorization, and be deliberate about it: an authorization is held for days at most before it expires and the funds are released, while a vehicle hold is commonly a week or more, so a design that leans on the authorization window will quietly start losing deposits at exactly the boundary nobody tested. Take the inventory reservation in the same transaction as the payment, and rely on the guaranteed reservation rather than on a read of available quantity — two buyers reaching the payment step within the same second is the case that matters, and it is the one the platform already handles correctly if you let it. Nothing expires on its own, so the hold period is a job you own; make it idempotent and make it the only thing that releases a unit, because a second release path is how a unit ends up sold twice. When the sale completes, carry the deposit onto the final order as its own Payment rather than reducing the price. The price did not change; part of it has already been paid, and the two are different statements to anyone reconciling the money afterwards.

## commercetools skills

Load `commercetools-checkout` before implementing this capability. Supporting: `commercetools-commerce-patterns`, `commercetools-connect`. Any task generated from this spec carries `[SKILL: commercetools-checkout]`.

## Open questions

- How long is a unit held for, and can the period be extended, by whom?
- At what point does the deposit stop being refundable, and who decides that per market?
- Which business in the chain receives the deposit, and how is it settled if the sale completes elsewhere?
- What happens to the deposit when the unit turns out to be undeliverable after it was reserved?

<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Equipment and its ongoing service bought in one checkout

## Purpose

A manufacturer selling a machine also sells what the machine consumes, and an industrial seller installing equipment also sells the service contract that keeps it running: the durable purchase and the ongoing commitment are one commercial decision and a buyer expects to make it once. Splitting them into two checkouts loses the attachment, which is where the recurring revenue comes from. What the buyer must not lose is clarity about what they have agreed to — the amount taken today and the amount that will be taken repeatedly are different promises, and a single total conceals the second one.

## Requirements

### Requirement: Equipment and its ongoing service bought in one checkout

The system SHALL allow one cart to hold both one-off and recurring lines and complete in a single checkout that both settles the amount due now and establishes the mandate for the recurring charges, showing the two amounts separately before confirmation.

#### Scenario: Two amounts shown separately
- **GIVEN** a cart holding a one-off purchase and a recurring service line
- **WHEN** the buyer reaches confirmation
- **THEN** the amount due now and the recurring amount with its cadence are shown separately, not as one total

#### Scenario: One authorization two obligations
- **GIVEN** a mixed cart at payment
- **WHEN** the buyer authorizes payment
- **THEN** the amount due now is settled and the mandate for the recurring charges is established in the same step

#### Scenario: Instrument cannot carry a mandate
- **GIVEN** a payment instrument that cannot support recurring charges
- **WHEN** the buyer selects it for a mixed cart
- **THEN** the limitation is stated before confirmation and an instrument that can carry the mandate is required for the recurring lines

#### Scenario: First charge date stated
- **GIVEN** a recurring line whose first charge falls after the one-off purchase is delivered
- **WHEN** the buyer reviews the order
- **THEN** the date the recurring charges begin is stated rather than left to be inferred

#### Scenario: Recurring line removed before confirmation
- **GIVEN** a mixed cart from which the buyer removes the recurring line
- **WHEN** the cart is repriced
- **THEN** the recurring amount and the mandate requirement are both removed, and the one-off purchase proceeds unchanged

#### Scenario: Recurring price not found for the cadence
- **GIVEN** a recurring line whose chosen cadence has no price of its own
- **WHEN** the cart is priced
- **THEN** the line is reported as not priceable at that cadence rather than being priced at the one-off amount

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| One-off and recurring lines in one cart | `[MIDDLEWARE]` | Each line carries its own cadence or none |
| Amount due now stated separately | `[MIDDLEWARE]` | What is being charged at confirmation |
| Recurring amount and its cadence stated separately | `[MIDDLEWARE]` | What will be charged, how often, and from when |
| First recurring charge date | `[MIDDLEWARE]` | Immediately, on delivery, or on a stated date |
| Mandate established in the same authorization | `[MIDDLEWARE]` | One payment step, two obligations |
| Instrument accepted for both obligations | `[MIDDLEWARE]` | Not every instrument can carry a recurring mandate |
| Recurring commitment on the confirmation | `[STATIC]` | Restated after purchase, not only before it |

## commercetools

**Entities:** `Cart`, `LineItem`, `RecurrencePolicy`, `RecurringOrder`, `Payment`, `Order`, `StandalonePrice`, `Type`

**Verified API surface**

- (concept) A Recurring Order defines the schedule and configuration for automatically creating and placing future Orders at regular predefined intervals on behalf of a customer, and acts as the base for generating new Orders according to that schedule — [docs](https://docs.commercetools.com/api/recurring-orders-overview)
- (concept) Recurrence Policies are defined on individual Line Items and Custom Line Items as well as on individual Prices, which is what allows one cart to contain lines that recur and lines that do not — [docs](https://docs.commercetools.com/api/recurring-orders-overview)
- (concept) Carts and Orders can reference a set of Payments through PaymentInfo, and a Payment holds the PSP, the payment method and its transactions — which is how one checkout records both the immediate capture and the instrument carrying the recurring mandate — [docs](https://docs.commercetools.com/api/projects/payments)
- (concept) Subscriptions notify a message queue when a resource is modified and are used to trigger asynchronous processes such as charging a card after an order has shipped, which is how a recurring schedule that starts on delivery rather than at purchase is driven — [docs](https://docs.commercetools.com/api/recurring-orders-overview)

**Constraints that change the design**

- For recurring Line Items price selection first seeks a recurrence-specific Price and falls back to the standard one-time purchase Price when none matches the Recurrence Policy, so a cadence with no price of its own is charged at the one-off price without error — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/price-calculation/price-selection)
- The financial process is carried out by an external PSP, so whether an instrument can carry a recurring mandate is a PSP capability the integration must assert; the platform records the Payment but does not validate mandate support — [docs](https://docs.commercetools.com/api/projects/payments)

**Modeling notes**

Attach the Recurrence Policy per line rather than per cart: that is what makes a mixed cart possible at all, and it is also what makes the price fallback dangerous, because a recurring line with no cadence-specific price is charged at the one-off price silently. Assert the resolved price came from the policy rather than trusting the cascade. The part teams consistently underestimate is the payment step: one authorization is being asked to do two different things, and whether an instrument can carry a mandate is a PSP fact the platform does not check — so validate mandate support before the buyer reaches confirmation, not after they have tried. Decide explicitly when the first recurring charge falls, because "on purchase" and "on delivery" are different integrations: the first is part of checkout, the second is driven by a Subscription reacting to the shipment, and retrofitting the second onto the first is a rebuild of the payment flow.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-checkout`, `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Does the recurring commitment begin at purchase, at delivery or at installation?
- Which instruments are permitted to carry a recurring mandate in each market?
- If the one-off purchase is canceled or returned, what happens to the recurring commitment attached to it?

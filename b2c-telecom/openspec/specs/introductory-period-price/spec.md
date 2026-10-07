<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# A free or reduced opening period that ends on a known date

## Purpose

Opening periods — a week free, a month at no charge, a reduced rate for six months — are how connectivity is sold, and they are also the single most common source of billing disputes. The reason is that the promotion is measured from the start of service, not from the campaign calendar: two customers buying the same offer on the same day can have different end dates if their service starts at different times. Treated as an ordinary time-windowed promotion, the free period ends for everyone at once and ends early for whoever was provisioned late. The customer's own dates are what they were sold and what they will hold the operator to, so the period has to be anchored to them and stated to them in advance.

## Requirements

### Requirement: A free or reduced opening period that ends on a known date

The system SHALL apply a promotional price for a stated opening period measured from the start of service and revert to the standing price when that period ends, showing the customer both amounts and the date the change takes effect before they commit.

#### Scenario: Both prices shown before commitment
- **GIVEN** an offer sold with a free opening period
- **WHEN** the customer reviews it
- **THEN** the promotional amount, the standing amount and the date the standing amount begins are all shown

#### Scenario: Period runs from start of service
- **GIVEN** two customers buying the same offer on the same day whose services start on different dates
- **WHEN** their opening periods are computed
- **THEN** each period runs from that customer's own start of service rather than from a shared campaign date

#### Scenario: Reverts without customer action
- **GIVEN** an opening period that has reached its end
- **WHEN** the next charge falls due
- **THEN** the standing price applies automatically, with no action required from the customer

#### Scenario: Campaign withdrawn after purchase
- **GIVEN** a customer already within an opening period
- **WHEN** the promotion is withdrawn from sale
- **THEN** the customer's agreed period runs to its stated end, and only new purchases are affected

#### Scenario: Service start delayed
- **GIVEN** a purchase whose provisioning is delayed past the expected start
- **WHEN** service finally starts
- **THEN** the opening period begins then, and the customer is not charged the standing price for a period they could not use

#### Scenario: Canceled within the opening period
- **GIVEN** a customer who cancels before the opening period ends
- **WHEN** the cancellation is processed
- **THEN** what is owed for the promotional period is resolved under a stated rule rather than left ambiguous

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Promotional amount for the opening period | `[MIDDLEWARE]` | Zero is the common case but not the only one |
| Duration of the period | `[MIDDLEWARE]` | Expressed as a length, not as a fixed calendar end |
| Period anchored to the start of service | `[MIDDLEWARE]` | Per customer, not per campaign |
| Standing price shown alongside it | `[MIDDLEWARE]` | What will be charged once the period ends |
| The date the price changes | `[MIDDLEWARE]` | Stated before commitment, not discovered on an invoice |
| Reversion without a further customer action | `[MIDDLEWARE]` | The customer does nothing and the correct price applies |
| Commitment restated after purchase | `[STATIC]` | On the confirmation, not only at the point of sale |

## commercetools

**Entities:** `CartDiscount`, `DiscountCode`, `RecurringOrder`, `RecurrencePolicy`, `StandalonePrice`, `Order`, `Subscription`, `Type`

**Verified API surface**

- (concept) A time window discount is modeled with Cart Discounts and Product Discounts, which is the documented mechanism for a promotion that applies only between two points in time — [docs](https://docs.commercetools.com/api/pricing-and-discounts-overview)
- (concept) PriceSelectionMode Dynamic makes each order generated from a Recurring Order retrieve and apply the current Product price, which is what lets a later period pick up the standing price once the promotional one no longer resolves — [docs](https://docs.commercetools.com/api/recurring-orders-overview)
- (concept) Subscriptions send notifications to a message queue when a resource is modified, and are used to trigger asynchronous background processes such as charging a card after an order has shipped — [docs](https://docs.commercetools.com/api/projects/subscriptions)

**Constraints that change the design**

- Discount validity is expressed as a calendar time range on the discount itself — the worked example is a promotion running from February 1 to February 14 — so the window is a property of the campaign and is identical for every customer, not measured from each customer's own start of service — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/discount-codes/discount-codes-and-cart-predicates)
- Subscriptions fire on resource modification, not on the passage of time: nothing in the platform emits an event because a stored end date has arrived, so the reversion at the end of an opening period must be driven by a scheduled job outside commercetools — [docs](https://docs.commercetools.com/api/projects/subscriptions)
- commercetools has no per-customer promotional-duration type: the number of days or months an individual customer's opening period runs for, and the date it ends, are implementation data carried in Custom Fields rather than a field the platform interprets — [docs](https://docs.commercetools.com/api/pricing-and-discounts-overview)

**Modeling notes**

Do not express the opening period as the discount's own validity window. That window is a campaign calendar shared by every customer, and the whole difficulty here is that the period belongs to the customer: it starts when their service does and ends a duration later. Carry the duration as configuration on the promotion, compute the end date per customer at activation, and store it against the subscription or order in a Custom Field. The discount then applies while that stored date is in the future, which is a predicate over the customer's own data rather than over the clock. Note what this costs you: nothing in the platform fires because a date arrived — Subscriptions react to resources changing — so the reversion needs a scheduled job of your own that sweeps stored end dates. Budget for it rather than discovering it late. Anchoring is the decision to make explicitly and early — order placement, activation, and first successful provisioning are three different dates, they can be weeks apart, and support will be asked to defend whichever one was chosen. Make the reversion event-driven off the stored end date rather than inferred at read time, so that the change of price is something the system did on a known date and can show, rather than an emergent property of a price lookup. Decide the cancellation rule at the same time: whether an opening period ended early is owed back is a commercial policy, and leaving it unstated means it gets decided per complaint.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-connect`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Does the opening period start at order, at activation, or at first successful provisioning?
- If provisioning is delayed, who bears the cost of the unused period?
- What is owed when a customer cancels inside the opening period?
- Can a customer hold more than one opening period at once across different services?

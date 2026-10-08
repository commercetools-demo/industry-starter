<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# What it costs in every year of the term, before signing

## Purpose

A multi-year connectivity contract is rarely one price. The discount steps down each year, or an introductory rate gives way to a standing one, and the headline figure the customer is sold on is the cheapest period of several. Presenting only that figure is how a contract becomes a complaint: the customer agreed to a number they were shown and is later billed one they were not. The schedule is also the thing the business needs to be able to state, because total contract value, not the first month, is what the commitment is worth. A price that is only known one period at a time cannot be summed, cannot be compared against a competing quote, and cannot be defended at the first increase.

## Plan notes

**As built by workstream L (D-013, D-065).** The schedule is stored per order as a Custom Field (`priceSchedule`, `{"v":1,"schedules":[...]}`); billing owns charging, commerce only stores the promise. Open-ended periods use `endsOn 9999-12-31`. "Mid term change reprices the remainder" is a library capability (`amendFrom`); there is no plan-change UI (D-040).

## Requirements

### Requirement: What it costs in every year of the term, before signing

Where an offer is sold on a commitment whose price changes between periods, the system SHALL price it from a schedule stating the amount payable in each period of the term and present every period's amount to the customer before they commit.

#### Scenario: Every period priced
- **GIVEN** an offer sold on a term whose discount changes each year
- **WHEN** the customer reviews it before committing
- **THEN** the amount payable in each year of the term is shown, not only the first

#### Scenario: Total contract value stated
- **GIVEN** a priced multi-period commitment
- **WHEN** the customer reaches confirmation
- **THEN** the total payable across the whole term is stated alongside the per-period amounts

#### Scenario: Schedule fixed at commitment
- **GIVEN** an order placed against an agreed schedule
- **WHEN** the catalog price of the offer later changes
- **THEN** the order's agreed schedule is unchanged, and the change applies only to new commitments

#### Scenario: End of term price disclosed
- **GIVEN** a term after whose expiry a different standing price applies
- **WHEN** the customer commits
- **THEN** the price the service reverts to and the date it takes effect are both stated

#### Scenario: Mid term change reprices the remainder
- **GIVEN** a commitment amended part-way through its term
- **WHEN** the amendment is priced
- **THEN** the remaining periods are repriced from the amendment date and the revised schedule is shown before it is accepted

#### Scenario: Period with no price
- **GIVEN** a term extending into a period the schedule does not cover
- **WHEN** the commitment is priced
- **THEN** it is reported as not priceable for the full term rather than being priced from the last known period

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Schedule of periods with an amount for each | `[MIDDLEWARE]` | The price of record for the term, not a projection |
| Period boundaries stated as dates | `[MIDDLEWARE]` | When each amount starts and stops applying |
| Every period shown before commitment | `[MIDDLEWARE]` | Not only the first and cheapest |
| Total payable across the term | `[MIDDLEWARE]` | What the commitment is actually worth |
| Amount due at order placement | `[MIDDLEWARE]` | Distinct from the recurring amounts that follow |
| Schedule preserved on the order | `[MIDDLEWARE]` | The agreed schedule is what billing must honour |
| Behavior at the end of the term stated | `[STATIC]` | What the price becomes once the commitment expires |

## commercetools

**Entities:** `RecurringOrder`, `RecurrencePolicy`, `LineItem`, `CustomLineItem`, `StandalonePrice`, `CartDiscount`, `Order`, `Type`

**Verified API surface**

- (concept) A Recurring Order defines the schedule and configuration for automatically creating and placing future Orders at regular predefined intervals on behalf of a customer, and acts as the base for generating those orders — [docs](https://docs.commercetools.com/api/recurring-orders-overview)
- (concept) PriceSelectionMode is defined through the recurrenceInfo field on each recurring item and determines whether a Recurring Order retains its original price or adopts a new one: Fixed keeps the price set when the Recurring Order was created, Dynamic retrieves and applies the current Product price each time an order is generated — [docs](https://docs.commercetools.com/api/recurring-orders-overview)
- (concept) For recurring Line Items price selection first seeks a recurrence-specific Price and falls back to the standard one-time purchase Price when none matches the Recurrence Policy — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/price-calculation/price-selection)

**Constraints that change the design**

- The two price selection modes are the whole of the choice: a price that is neither frozen nor tracking the catalog — one that steps to a different agreed amount at each period boundary — is not expressible as a PriceSelectionMode and has to be driven by the implementation — [docs](https://docs.commercetools.com/api/recurring-orders-overview)
- A Recurrence Policy schedule is either a StandardSchedule with an intervalUnit of Days, Weeks or Months and a value for the number of intervals, or a DayOfMonthSchedule for a specific date each month — it expresses when an order recurs, not a different amount per occurrence — [docs](https://docs.commercetools.com/api/recurring-orders-overview)

**Modeling notes**

The schedule is the deliverable and the platform does not have a type for it. Recurring Orders give you the cadence and two price modes, Fixed and Dynamic, and a stepped term price is neither: Fixed freezes year one's discounted rate for the whole term, and Dynamic hands the customer whatever the catalog says next year. Choosing either by default is the modeling error, and it is silent — Fixed in particular looks correct right up to the first period boundary. Hold the agreed schedule explicitly as its own record, keyed to the order, and drive each period's amount from it. Then decide who applies it: the commerce platform generating each period's order at the scheduled amount, or a billing system that owns the term and treats commerce as the place the contract was captured. Both are legitimate and the choice is architectural, so make it before building either. Whichever way it goes, write the schedule onto the order at placement rather than recomputing it later from catalog state — the customer agreed to a specific set of numbers, and the ability to show exactly those numbers back is what makes the commitment defensible. Watch the price-selection fallback while you are here: a recurring line with no price for its cadence is charged at the one-off price with no error.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-connect`, `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Does commerce or the billing system own the term schedule once the order is placed?
- What happens to the remaining schedule when a commitment is canceled early, and what is recovered?
- Does the price revert automatically at the end of the term, or does the term renew on its last agreed amount?
- How is a mid-term amendment priced — from the amendment date, or by rebasing the whole term?

<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# A base charge with an included allowance, and what exceeds it

## Purpose

Industrial service is sold as a program rather than a product: a monthly charge buys a bundle — so many containers, so many visits, so much throughput — and everything past it is extra. Buyers of these programs need to see the line between the two before they commit, because the whole commercial question is whether their volume fits the allowance. Presenting one monthly figure without the split is what produces the argument at the first invoice, and applying the base charge per unit rather than per program is the modeling error that makes the price wrong by a multiple rather than a margin.

## Requirements

### Requirement: A base charge with an included allowance, and what exceeds it

The system SHALL price a recurring service as a base charge covering a stated included allowance, with quantities beyond that allowance charged additively at their own rates, and show the buyer which units are included and which are being charged for.

#### Scenario: Within the allowance
- **GIVEN** a program whose included allowance covers everything the buyer has configured
- **WHEN** the buyer reviews the price
- **THEN** only the base charge applies, and the covered units are shown as included at no additional charge

#### Scenario: Beyond the allowance
- **GIVEN** a configuration exceeding the included allowance
- **WHEN** the buyer reviews the price
- **THEN** the base charge is shown once with the units within the allowance marked included, and only the excess is charged additively

#### Scenario: Base charge not multiplied
- **GIVEN** a program covering several types of unit
- **WHEN** the recurring price is computed
- **THEN** the base charge is applied once at the program level rather than once per type

#### Scenario: Type outside the bundle
- **GIVEN** a unit type the bundle does not include at all
- **WHEN** it is added
- **THEN** it is charged in full at its own rate and identified as outside the bundle

#### Scenario: Frequency changes the total
- **GIVEN** a program priced against a chosen service cadence
- **WHEN** the buyer selects a different cadence
- **THEN** the recurring total is recomputed and the change is shown before confirmation

#### Scenario: Overage rates disclosed before commitment
- **GIVEN** a program with charges for exceeding its allowance during a period
- **WHEN** the buyer reaches confirmation
- **THEN** the overage rates are stated, rather than appearing for the first time on an invoice

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Base charge at the program level | `[MIDDLEWARE]` | One charge for the bundle, never one per unit within it |
| Included allowance stated by type and quantity | `[MIDDLEWARE]` | What the base charge already covers |
| Units beyond the allowance priced additively | `[MIDDLEWARE]` | At each type's own rate |
| Types outside the bundle priced in full | `[MIDDLEWARE]` | Not every type is in the allowance at all |
| Service frequency as a pricing input | `[MIDDLEWARE]` | The cadence chosen changes the recurring charge |
| Overage rates stated up front | `[STATIC]` | What exceeding the allowance in a period will cost |
| Recurring total broken into its parts | `[MIDDLEWARE]` | Base, additive, and any surcharge, each separately |

## commercetools

**Entities:** `Cart`, `LineItem`, `CustomLineItem`, `RecurrencePolicy`, `RecurringOrder`, `StandalonePrice`, `Order`, `Type`

**Verified API surface**

- (concept) A Recurrence Policy defines a schedule for selling recurring products at specific prices and is set on individual Line Items and Custom Line Items as well as on individual Prices, both Standalone and Embedded, and can be reused across Recurring Orders — [docs](https://docs.commercetools.com/api/recurring-orders-overview)
- (concept) A Recurrence Policy schedule is either a StandardSchedule with an intervalUnit of Days, Weeks or Months and a value for the number of intervals between orders, or a DayOfMonthSchedule for a specific date each month — [docs](https://docs.commercetools.com/api/recurring-orders-overview)
- (concept) addCustomLineItem charges for something not represented as a Product Variant, which is how a program-level base charge and a separately stated surcharge sit in the cart as inspectable lines — [docs](https://docs.commercetools.com/learning-implement-carts-and-shopping-lists/implement-carts/update-carts)

**Constraints that change the design**

- For recurring Line Items the platform first looks for a recurrence-specific Price using the price selection cascade and falls back to the standard one-time purchase Price if no Price matches the Recurrence Policy — so a missing cadence-specific price resolves to the one-off price silently — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/price-calculation/price-selection)
- commercetools has no included-allowance, entitlement or overage price type: the allowance, the units it covers and the excess are computed outside price selection and written to the cart as lines and Custom Fields — [docs](https://docs.commercetools.com/api/pricing-and-discounts-overview)
- Actual consumption is not known to commercetools at order time, so an overage arising from usage during a period is billed by the system that measures it; the platform can carry the agreed rate but is not the record of what was consumed — [docs](https://docs.commercetools.com/api/recurring-orders-overview)

**Modeling notes**

Put the base charge on one Custom Line Item at the program level and carry the allowance it covers in its Custom Fields, then add the excess as its own lines. The alternative that looks tidier — a bundle product with a price and components inside it — cannot express "two of these are included and the third is not", because the platform prices a line by quantity and has no notion of an allowance inside one. Attach the Recurrence Policy per line and be aware of the fallback: if no price exists for the chosen cadence, price selection quietly uses the one-off price, so a program sold at an unusual frequency can price at the wrong number without any error. Assert that the resolved price matched the policy. Finally, separate the two kinds of overage: exceeding the allowance in the configuration is knowable now and belongs in the price the buyer confirms, while exceeding it through consumption during the period is not knowable here at all — the platform holds the agreed rate and the metering system owns the quantity.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-connect`, `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Which system measures consumption during a period, and how does an overage reach billing?
- Does an unused allowance carry forward, and over what horizon?
- Is the allowance held per site or per organization when one program covers several sites?

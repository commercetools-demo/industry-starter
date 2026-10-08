<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# A restricted instrument paying only for the lines it may pay for

## Purpose

Health spending instruments are not general-purpose money. The account they draw on exists because it was granted a particular treatment on the condition that it is spent on qualifying goods, and the store carrying those goods almost always carries others alongside them — the eligible dressing and the ineligible cosmetic sit in the same basket because they sit on the same shelf. The consequence of getting this wrong lands on the cardholder rather than the seller: a payment that should never have been accepted becomes their problem to unwind, months later, with the goods long since used. So the split is not a convenience at the payment step, it is the thing that makes the instrument usable at all. It also has to be visible earlier than checkout. A shopper who learns at the payment screen that only part of their basket qualifies has already chosen the basket; the eligible subtotal belongs on the basket itself, where it can still change what they buy. And because eligibility is a property of the goods rather than of the shopper, it survives on the order — the line-by-line record of what was treated as qualifying is what any later substantiation rests on.

## Requirements

### Requirement: A restricted instrument paying only for the lines it may pay for

The system SHALL limit a restricted health payment instrument to settling only the basket lines that qualify for it, and require the remaining lines to be settled by another tender.

#### Scenario: Wholly eligible basket
- **GIVEN** a basket in which every line qualifies
- **WHEN** the restricted instrument is used
- **THEN** it settles the whole order and no second tender is required

#### Scenario: Mixed basket splits
- **GIVEN** a basket mixing qualifying and non-qualifying lines
- **WHEN** the restricted instrument is used
- **THEN** it is charged no more than the qualifying subtotal and the rest is charged to another tender

#### Scenario: Eligible subtotal shown on the basket
- **GIVEN** a shopper with qualifying and non-qualifying items in the basket
- **WHEN** they view it
- **THEN** the qualifying subtotal and the amount needing another tender are both shown before checkout

#### Scenario: Wholly ineligible basket
- **GIVEN** a basket in which nothing qualifies
- **WHEN** the restricted instrument is offered
- **THEN** it is not available for this order, and the reason is stated

#### Scenario: Basket change re splits
- **GIVEN** a basket already split between two tenders
- **WHEN** a line is added or removed
- **THEN** both amounts are recomputed before payment is taken

#### Scenario: Eligibility visible on the order
- **GIVEN** a completed mixed order
- **WHEN** it is read afterwards
- **THEN** each line states whether it was treated as qualifying and which instrument settled it

#### Scenario: Refund returns to its own instrument
- **GIVEN** a refund on a mixed order
- **WHEN** it is processed
- **THEN** qualifying value returns to the restricted instrument and the rest to the tender that paid it

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Eligibility declared per product for each instrument class | `[CACHED]` | A property of the goods, maintained as catalog data |
| Eligible subtotal computed and shown on the basket | `[MIDDLEWARE]` | Visible while the shopper can still change what is in it |
| Restricted instrument capped at the eligible subtotal | `[MIDDLEWARE]` | Never the basket total, even when the instrument has the balance |
| Remainder routed to a second tender | `[MIDDLEWARE]` | One order, two instruments, each with its own amount |
| Eligibility recorded per line on the order | `[MIDDLEWARE]` | What was treated as qualifying, as it was judged at the time |
| Re-split when the basket changes | `[MIDDLEWARE]` | Adding one ineligible item changes both amounts |
| Refund returned to the instrument that paid | `[MIDDLEWARE]` | Value cannot move between instruments on the way back |

## commercetools

**Entities:** `Payment`, `PaymentInfo`, `Cart`, `LineItem`, `Order`, `ProductType`, `Type`, `Extension`

**Verified API surface**

- (concept) A Payment holds information about the payment service provider, the payment method used, any related transactions and the current state of the Payment, and an Order or Cart can reference a set of Payments using the PaymentInfo object — [docs](https://docs.commercetools.com/api/projects/payments)

**Constraints that change the design**

- commercetools has no concept of a tender restricted to a subset of Line Items: PaymentInfo references Payments against the Order as a whole, so the qualifying subtotal and the cap on the restricted instrument are computed and enforced by the implementation before the Payment amount is set — [docs](https://docs.commercetools.com/api/projects/payments)
- Custom Fields cannot be assigned to Products, so an eligibility marker on the goods is a Product Type Attribute, and making it searchable is what lets a basket be split without reading every product individually — [docs](https://docs.commercetools.com/learning-model-your-business-structure/extensibility/data-model-extensions)
- Checkout manages Payment authorization and creates the Order, but the business logic for triggering captures, cancellations and refunds is the implementation's responsibility — so returning refunded value to the correct instrument is code you write — [docs](https://docs.commercetools.com/learning-implement-checkout/implement-commercetools-checkout/payment-lifecycle)

**Modeling notes**

Two Payments on one Order, each with its own amountPlanned, is the whole shape — the platform supports several Payments per Order and will not object to either amount, which is exactly why the cap has to be computed and asserted before the Payment is created rather than trusted to the payment step. Mark eligibility as a searchable Product Type Attribute, not a Custom Field, because Products cannot carry Custom Fields and because you will want to sum the qualifying lines without fetching each product. Copy the judgment onto the Line Item at add time as well as leaving it on the product: eligibility rules change, and the order has to say what was judged then, not what would be judged now. Compute the qualifying subtotal at the same moment you compute the order total and re-compute it on every basket change, since a single added line moves both figures. Two traps are worth naming. Discounts distributed across the basket will shift value between qualifying and non-qualifying lines unless you decide how they apportion, and shipping is almost never qualifying but is charged once on the order — settle both questions explicitly rather than letting the totals fall where they may. Refunds are the last mile: value cannot cross instruments on the way back, so the split has to be reconstructed from the order, which is the reason it is recorded there in the first place.

## commercetools skills

Load `commercetools-checkout` before implementing this capability. Supporting: `commercetools-commerce-patterns`, `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-checkout]`.

## Open questions

- Who maintains the eligibility list for each instrument class, and how often does it change?
- How do basket-level discounts apportion between qualifying and non-qualifying lines?
- Is shipping ever qualifying, and if so under what condition?
- What evidence of the eligibility judgment must be retained, and for how long?

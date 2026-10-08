<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# The same hardware bought outright, in installments, or on lease

## Purpose

Connectivity hardware is the same physical thing whichever way it is paid for, and the way it is paid for is the customer's decision, not a property of the product. A handset bought outright, the same handset over twenty-four installments, and the same handset on a lease that ends with its return are one SKU and three commercial agreements, differing in what is owed today, what is owed monthly, who owns the device, and what happens at the end. Modeling them as three products triples the catalog and guarantees drift the moment a specification changes. Modeling them as one product with no mode on the line loses the distinction that decides the invoice and the end-of-term obligation. The mode belongs on the line, chosen at purchase, and it has to survive onto the order because everything downstream — billing, asset tracking, returns, upgrade eligibility — is a different process for each one.

## Plan notes

**As built by workstreams G and Q (D-015, D-060).** All six scenarios are built. One product and one SKU per device; mode and term are line item custom fields; financed lines use the policies `malva-device-installment-12/24/36` and `malva-device-lease-24`. A plan plus a device in one order produce ONE Recurring Order (grouping is by schedule), so the device end date is stored on the line (`acquisitionEndDate`) and the platform expiry is set only for device-only orders. The credit decision is a deterministic stub (flag `creditApproved`, limit USD 2,500 / EUR 2,300). Guests can only buy outright. Handset demo prices are placeholders (M-Q-2).

## Requirements

### Requirement: The same hardware bought outright, in installments, or on lease

The system SHALL let the customer choose how each hardware line is acquired — outright, over an installment term, or on lease — and price that line according to the mode chosen, carrying the mode and its term through to the order.

#### Scenario: Same device three modes
- **GIVEN** a device offered outright, on installments and on lease
- **WHEN** the customer selects a mode
- **THEN** the line is priced for that mode and shows the amount due now and any recurring amount with its term

#### Scenario: Mixed modes in one order
- **GIVEN** a cart holding one device bought outright and another on installments
- **WHEN** the order is placed
- **THEN** each line carries its own acquisition mode and term, and the order states the totals for each

#### Scenario: Mode unavailable for this device
- **GIVEN** a device not offered on lease
- **WHEN** lease is requested for it
- **THEN** the mode is refused for that line and the modes that are available are named

#### Scenario: End of term obligation disclosed
- **GIVEN** a lease that requires the device to be returned at the end of its term
- **WHEN** the customer reviews the line before committing
- **THEN** the end-of-term obligation and the date it falls due are stated

#### Scenario: Mode persisted to the order
- **GIVEN** an order containing a financed device line
- **WHEN** the order is read by billing or asset tracking
- **THEN** the acquisition mode and term are present on the line rather than inferred from the price

#### Scenario: Mode changed before checkout
- **GIVEN** a hardware line in the cart on one acquisition mode
- **WHEN** the customer changes the mode
- **THEN** the line is repriced, the amount due now and the recurring amount are both updated, and the term is restated

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Acquisition mode chosen per hardware line | `[MIDDLEWARE]` | A property of the line, not of the product |
| Modes available to this customer and device | `[MIDDLEWARE]` | Not every mode is offered on every device or to every customer |
| Amount due now for the chosen mode | `[MIDDLEWARE]` | Full price, a deposit, or nothing |
| Recurring amount and its term | `[MIDDLEWARE]` | Absent for outright purchase, central to the others |
| End-of-term obligation stated | `[STATIC]` | Owned outright, returnable, or renewable |
| Mode and term carried onto the order | `[MIDDLEWARE]` | Billing and asset tracking both read it from there |
| Mixed modes in one order | `[MIDDLEWARE]` | One order can hold lines acquired three different ways |

## commercetools

**Entities:** `Cart`, `LineItem`, `CustomLineItem`, `RecurrencePolicy`, `RecurringOrder`, `StandalonePrice`, `Order`, `Payment`, `Type`

**Verified API surface**

- (concept) Line Items and Custom Line Items carry information about possible recurrence, and for each recurring item you define when or how often it should be ordered as well as the pricing mode, using a Recurrence Policy set through RecurrenceInfo on that item — [docs](https://docs.commercetools.com/api/recurring-orders-overview)
- (concept) Carts and Orders reference Payments through PaymentInfo and a Payment holds the PSP, the payment method and its transactions, which is how one order records both an amount settled now and the instrument carrying an ongoing obligation — [docs](https://docs.commercetools.com/api/projects/payments)

**Constraints that change the design**

- Recurrence is set per Line Item rather than per Cart, which is precisely what allows one cart to hold an outright purchase alongside a financed line and a leased line — [docs](https://docs.commercetools.com/api/recurring-orders-overview)
- For recurring Line Items price selection first seeks a recurrence-specific Price and falls back to the standard one-time purchase Price when none matches the Recurrence Policy, so a financed line with no price for its term is silently charged the outright price — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/price-calculation/price-selection)
- commercetools has no acquisition-mode, financing, lease or asset-ownership concept: who owns the device, what is owed at the end of a term and whether it must be returned are implementation data held in Custom Fields, and the platform will not enforce or interpret them — [docs](https://docs.commercetools.com/api/recurring-orders-overview)

**Modeling notes**

One product, one SKU, mode on the line. Resist the three-products shortcut: it looks simpler on day one and it is a catalog maintenance liability from day two, because every specification, image and availability change then has to be made three times and will eventually be made twice. Put the mode and its term in Custom Fields on the Line Item and attach a Recurrence Policy to the financed and leased lines, which is what lets the three coexist in one cart at all. The failure to watch for is the price fallback: a financed line whose term has no price of its own resolves to the outright price with no error at all, which on hardware is a large number presented as a monthly one. Assert the resolved price came from the policy. Keep the end-of-term obligation explicit even though the platform has no concept of it — whether the customer owns the device, owes a final payment or must return it is the single most disputed part of these agreements, and it needs to be on the order rather than in a terms document. Finally, do not conflate financing with the plan: a device paid over twenty-four months and a service commitment of twenty-four months are separate agreements that are frequently sold together and can be canceled independently, and merging them makes early cancellation impossible to compute.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-checkout`, `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Which system owns the financing agreement and the credit decision behind it, and at what point in checkout is it made?
- Can the acquisition mode change after the order is placed, and what does that do to the remaining term?
- How is a leased device tracked as an asset, and which system holds its serial identity?
- When a device is financed over the same period as a service commitment, can either be canceled alone?

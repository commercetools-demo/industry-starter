<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Goods that cannot be supplied without work someone has to do

## Purpose

Some parts are not goods you can post. A tow bar, a roof system, a retrofitted module — these are sold as an item and delivered as an outcome, and the outcome needs someone with a ramp, a torque wrench and the liability cover to sign it off. That makes the fitter part of the product rather than a service bolted on afterwards, and it has to be settled while the item is being chosen: fitting rates differ between businesses, availability differs between them, and a buyer who picks the part and discovers at checkout that nobody near them will fit it has been led a long way to a dead end. The awkward consequence is that the basket stops being homogeneous. A wiper blade and a tow bar bought together have nothing in common downstream — one is a parcel, the other is an appointment at a named site on a date that has not been agreed yet — so the fulfillment decision belongs to the line, and one order can end up involving several businesses. Scheduling is the part worth keeping out of the purchase. Making the buyer find a slot before they have paid adds an abandonment point to a journey that has enough of them; the commitment is to have it fitted there, and the date can follow.

## Requirements

### Requirement: Goods that cannot be supplied without work someone has to do

The system SHALL require, for any item that cannot be supplied without being fitted, that the business performing the fitting is chosen on that line before the item can be bought, and price the fitting at that business's own rate.

#### Scenario: Fitting required before purchase
- **GIVEN** an item that cannot be supplied without fitting
- **WHEN** it is added to the basket without a performing business
- **THEN** it cannot be bought until one is chosen

#### Scenario: Rate follows the chosen business
- **GIVEN** two businesses offering the same fitting at different rates
- **WHEN** the buyer chooses one
- **THEN** the line is priced at that business's rate and the charge is shown separately

#### Scenario: Mixed basket fulfilled per line
- **GIVEN** a basket holding one parcelled item and one requiring fitting
- **WHEN** the order is placed
- **THEN** each line carries its own fulfillment arrangement

#### Scenario: Two fitted lines two sites
- **GIVEN** two fitted items assigned to different businesses
- **WHEN** the order is placed
- **THEN** each line records its own performing business

#### Scenario: No fitter available
- **GIVEN** an item requiring fitting with no business able to perform it for this buyer
- **WHEN** they attempt to buy it
- **THEN** they are told so rather than being allowed to buy an item nobody can fit

#### Scenario: Appointment after purchase
- **GIVEN** a completed order containing a fitted line
- **WHEN** the buyer is asked for a date
- **THEN** it is asked after payment, and the order stands until a date is agreed

#### Scenario: Changing the performing business
- **GIVEN** a fitted line already assigned to one business
- **WHEN** the buyer changes it before checkout
- **THEN** the line is repriced at the new business's rate

#### Scenario: Fitting cannot be completed
- **GIVEN** a paid order whose fitting cannot be performed
- **WHEN** that becomes known
- **THEN** the order records it and the buyer is offered the alternatives, rather than the line being silently closed

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Fitting requirement declared on the item | `[CACHED]` | A property of the goods, known before the basket |
| Performing business chosen on the line | `[MIDDLEWARE]` | Chosen while the item is chosen, not at checkout |
| Fitting priced at that business's own rate | `[MIDDLEWARE]` | Rates differ between businesses for the same work |
| Fitting stated as its own charge | `[MIDDLEWARE]` | Separate from the part, so the buyer can see both |
| Per-line fulfillment in a mixed basket | `[MIDDLEWARE]` | Parcelled lines and fitted lines in one order |
| Several performing businesses in one order | `[MIDDLEWARE]` | Each fitted line can go to a different site |
| Appointment arranged after purchase | `[MIDDLEWARE]` | The commitment is the site; the date follows |
| A defined answer when fitting cannot proceed | `[MIDDLEWARE]` | The part is paid for and the work is not done |

## commercetools

**Entities:** `Cart`, `LineItem`, `CustomLineItem`, `ShippingMethod`, `Channel`, `Store`, `Order`, `Type`, `Extension`

**Verified API surface**

- (concept) Any address bound to a Line Item or a sub-quantity of one must be added to the Cart's itemShippingAddresses with a key unique to the Cart, and is then referenced from the Line Item through an ItemShippingTarget using Set LineItem ShippingDetails — [docs](https://docs.commercetools.com/api/shipping-delivery-overview)
- (concept) Sub-quantities of a single Line Item can be directed to different addresses, so one line of several units does not have to resolve to one destination — [docs](https://docs.commercetools.com/api/shipping-delivery-overview)
- (concept) Custom Line Items can be added to a Cart with their own money amount, their own tax rate and their own shipping details through setCustomLineItemShippingDetails, which is how a charge that is not a catalog product is carried and routed — [docs](https://docs.commercetools.com/api/carts-orders-overview)
- (concept) Shipping rules expressed through Cart Predicates control which shipping methods are offered during checkout, and shipping costs can be fixed or driven by cart value, cart classification or a numeric score — [docs](https://docs.commercetools.com/api/shipping-delivery-overview)

**Constraints that change the design**

- A Cart's ShippingMode is set on the CartDraft and cannot be changed afterwards, with Single using one shipping and tax context for the whole Cart and Multiple required when items go to addresses in different countries or regions — [docs](https://docs.commercetools.com/api/shipping-delivery-overview)
- commercetools has no appointment, booking or work-scheduling resource and no concept of a party that performs a service on a line: the performing business is a Channel or Custom Field reference, and the calendar behind it belongs to another system — [docs](https://docs.commercetools.com/api/projects/custom-objects)

**Modeling notes**

Two lines, one decision. Carry the part as a Line Item and the fitting as a Custom Line Item priced at the chosen business's rate, linked to the part through a Custom Field so the pair travels together and neither can be removed alone. Identify the performing business as a Channel — it is already the resource for "a place that supplies or does something" and it keeps the rate lookup and the fulfillment routing on the same key. Decide ShippingMode at the moment the cart is created and not later: it is fixed on the CartDraft and cannot be changed, so a basket that starts as a simple parcel order and acquires a fitted line has a problem that is expensive to unpick. If fitted lines are possible at all in a given storefront, create the cart in the mode that supports them. Do not build a scheduling system here. commercetools has no appointment resource, the calendar lives in the workshop's own system, and the honest boundary is that the order records which business is committed and carries a reference to a booking made elsewhere. That also keeps the purchase out of the workshop's availability window, which is the thing that would otherwise block checkout. Finally, give the unperformable case a real path. The part is paid for, the work is not done, and the default behavior of most implementations — closing the line quietly — leaves a buyer with a tow bar in a box and no explanation.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-checkout`, `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Who owns the fitting rate for each business, and how often does it change?
- Can a buyer collect a fitting-required part without having it fitted, and under what conditions?
- Which system holds the appointment calendar, and how does the order learn that the work was done?
- When fitting cannot be performed, who bears the cost of returning or re-routing the part?

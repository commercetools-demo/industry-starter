<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Statutory duties on a vehicle, and the buyers relieved of them

## Purpose

A vehicle attracts charges that are not the seller's price and not ordinary sales tax. They are levied on registering the thing rather than on selling it, they are computed from the vehicle's own characteristics — emissions, power, mass, fuel, sometimes age — and they can run to a substantial fraction of the total. Presenting them inside the price is wrong twice over: the buyer cannot see what is the seller's margin and what is the state's, and the duty is not discountable, so folding it in invites promotions to erode something that has to be handed over in full. The part that defeats a conventional tax setup is relief. Reduced and zero rates attach to who is buying and why — an adapted vehicle, a licensed passenger-carrying operator, a diplomatic mission, a household with a qualifying status — so the rate depends on the customer, not only on the destination. That inverts the usual model, in which tax is a property of the goods and the delivery address, and it means the entitlement has to be established and evidenced during the purchase rather than assumed from a flag somebody set on an account.

## Requirements

### Requirement: Statutory duties on a vehicle, and the buyers relieved of them

The system SHALL compute the statutory duties payable on putting a vehicle on the road from the vehicle's own characteristics, the market it is destined for and the buyer's established entitlement to relief, stating each duty separately from the price of the goods.

#### Scenario: Duty computed and itemized
- **GIVEN** a configured vehicle destined for a given market
- **WHEN** the total is calculated
- **THEN** each statutory duty appears as its own line, separate from the price of the goods

#### Scenario: Relief applied on entitlement
- **GIVEN** a buyer with an established and evidenced entitlement to relief
- **WHEN** the total is calculated
- **THEN** the reduced or zero rate is applied and shown as a reduction against the duty concerned

#### Scenario: Relief claimed but not evidenced
- **GIVEN** a buyer who claims relief without providing evidence
- **WHEN** they attempt to complete
- **THEN** the full duty stands until the evidence is accepted, and the reason is stated

#### Scenario: Relief differs per duty
- **GIVEN** an entitlement that reduces one duty and exempts another entirely
- **WHEN** the total is calculated
- **THEN** each duty reflects its own treatment rather than one blanket rate

#### Scenario: Destination differs from point of sale
- **GIVEN** a vehicle bought in one market and registered in another
- **WHEN** duties are computed
- **THEN** the destination market's rules apply

#### Scenario: Promotions do not erode duty
- **GIVEN** a discount applied to the vehicle
- **WHEN** the total is recalculated
- **THEN** the duty is unchanged and only the seller's price falls

#### Scenario: Rate changes after the order
- **GIVEN** an order placed before a rate change
- **WHEN** it is read afterwards
- **THEN** it states the rate that was in force when it was placed

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Duty computed from the vehicle's own characteristics | `[MIDDLEWARE]` | Emissions, power, mass and fuel, not the selling price alone |
| Destination market as the second input | `[MIDDLEWARE]` | Where it will be registered, which need not be where it is sold |
| Buyer entitlement to relief resolved per purchase | `[MIDDLEWARE]` | Relief attaches to who is buying, not to the goods |
| Evidence required before relief is applied | `[MIDDLEWARE]` | Claimed and evidenced are different states |
| Each duty stated as its own line | `[MIDDLEWARE]` | Separate from the goods, and separate from each other |
| Relief shown against the duty it reduces | `[MIDDLEWARE]` | A visible reduction, not a quietly smaller number |
| Duty excluded from the discountable base | `[MIDDLEWARE]` | Promotions reduce the seller's price, never the state's |
| The rate in force at the sale recorded | `[MIDDLEWARE]` | Rates change on dates, and orders outlive the change |

## commercetools

**Entities:** `TaxCategory`, `TaxRate`, `SubRate`, `Cart`, `LineItem`, `CustomLineItem`, `Order`, `CustomerGroup`, `Type`, `Extension`

**Verified API surface**

- (concept) A Tax Category is a container for Tax Rates and a Tax Rate is the percentage for a specific country and optionally a state or region, typically based on the delivery address, with a SubRate being a component of a compound rate where all SubRates sum to the Tax Rate — [docs](https://docs.commercetools.com/learning-model-your-business-structure/model-your-taxes/tax-categories-and-tax-rates)
- (concept) Different Tax Categories can be applied independently to each Line Item in a Cart, and Custom Line Items can carry their own tax rate through setCustomLineItemTaxRate and setCustomLineItemTaxAmount — [docs](https://docs.commercetools.com/api/carts-orders-overview)
- (update-action) changeTaxMode switches a Cart to External or ExternalAmount, where an outside tax service supplies the rates or the exact amounts — the documented route when the rules are more complex than Tax Categories can express — [docs](https://docs.commercetools.com/learning-implement-carts-and-shopping-lists/implement-carts/update-carts)
- (concept) Whether a price is net or gross is a property of the Tax Rate through includedInPrice, and the Cart's taxedPrice exposes both totalNet and totalGross after calculation — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-b2b-pricing/net-and-gross-prices-and-tax)

**Constraints that change the design**

- A Tax Rate is keyed on country and optionally state, and a single Tax Category is assigned to the Product rather than the Product Variant — so a rate that varies by who is buying rather than by where it is going has no native representation in the tax model — [docs](https://docs.commercetools.com/learning-model-your-business-structure/model-your-taxes/tax-categories-and-tax-rates)
- Complex jurisdictions require an external tax provider through External or ExternalAmount tax mode, and treating them as configuration inside commercetools is a documented and costly modeling mistake — [docs](https://docs.commercetools.com/api/carts-orders-overview)

**Modeling notes**

Separate the two things the word tax is doing here. Ordinary sales tax on the goods is what Tax Categories are for and should stay there. A registration duty is not that: it is computed from the vehicle rather than from the price, it is often not a percentage at all, and it is payable whether or not the sale attracts sales tax. Model it as a Custom Line Item with its own amount and its own tax treatment, which also gets you the separation the buyer needs to see and keeps it outside any discount predicate that targets line items. Relief is the part that forces a decision. Tax Rates key on country and optionally state, and the Tax Category sits on the Product, so there is no supported way to say that this rate applies to this buyer — a Customer Group will not do it, because the group does not participate in tax selection the way it participates in price selection. Once relief is in play, move the cart to External or ExternalAmount tax mode and let a service that knows the rules answer, rather than trying to enumerate rate combinations as categories. Keep claimed and evidenced apart as states, since the gap between them is where the commercial risk sits: relief granted on an unevidenced claim is money the seller may have to find later. And record the computed duty and the rate version on the order rather than recomputing it on read, because these rates change on legislated dates and an order re-priced against today's rules is a document that contradicts the contract it represents.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-platform`, `commercetools-connect`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Which system computes each market's duties, and how are legislated rate changes scheduled into it?
- What evidence is required for each category of relief, who verifies it, and how long is it retained?
- When the destination market changes after the order, who bears the difference in duty?
- Are duties ever payable to a party other than the selling business, and how is that settled?

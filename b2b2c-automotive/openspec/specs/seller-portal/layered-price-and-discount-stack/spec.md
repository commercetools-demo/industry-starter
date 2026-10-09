<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Every contribution to the price, itemized and in the order applied

## Purpose

A vehicle price is not a number, it is an argument. It starts from a recommended price, has several discounts subtracted by different organizations for different reasons, picks up charges that are taxable and charges that are not, and ends with duties that are calculated on a base which depends on everything above. In many markets showing that derivation is a legal obligation rather than a courtesy, and even where it is not, the buyer is comparing this itemisation against another dealer's and will not accept a single total. Two things make this hard in a way an ordinary promotion stack is not. The order of application changes the answer: a percentage taken before a fixed amount is not the same money as the reverse, and with four-figure discounts the difference is real. And the tax boundary cuts through the middle of the stack, so a charge placed on the wrong side of it produces a total that is not merely surprising but wrong. What matters is therefore not only that the right discounts applied, but that the sequence is deliberate, stated, and preserved on the order rather than reconstructed afterwards from the totals.

## Requirements

### Requirement: Every contribution to the price, itemized and in the order applied

The system SHALL present the price of a vehicle as an ordered, itemized build-up of every contribution to it — the list price, each discount, each additional charge and each duty — distinguishing the contributions applied before tax from those applied after it.

#### Scenario: Build up shown line by line
- **GIVEN** a configured vehicle with several discounts and charges
- **WHEN** its price is presented
- **THEN** each contribution appears as its own labeled line between the list price and the total

#### Scenario: Order of application is deliberate
- **GIVEN** a percentage discount and a fixed-amount discount on the same vehicle
- **WHEN** the price is calculated
- **THEN** they apply in the defined order, and the same order produces the same total every time

#### Scenario: Charge before tax versus after
- **GIVEN** a taxable preparation charge and a non-taxable after-tax charge
- **WHEN** the total is calculated
- **THEN** tax is computed on a base that includes the first and excludes the second

#### Scenario: Voucher joins the stack
- **GIVEN** a buyer who enters a voucher code
- **WHEN** it is accepted
- **THEN** it appears as a further line in the same build-up, in its place in the order

#### Scenario: Stack survives onto the order
- **GIVEN** a placed order for a configured vehicle
- **WHEN** the order is read afterwards
- **THEN** the itemized build-up is present as it was shown, without being recalculated

#### Scenario: Contribution attributable
- **GIVEN** a discount granted by one organization in the chain
- **WHEN** the build-up is examined
- **THEN** the line states which organization's discount it is

#### Scenario: Totals agree across channels
- **GIVEN** the same configuration quoted online and at the point of sale
- **WHEN** both are produced
- **THEN** the build-up and the total agree

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Starting list price shown as its own line | `[CACHED]` | The published recommended price the build-up starts from |
| Each discount as a separate, labeled line | `[MIDDLEWARE]` | Never rolled into one total saving |
| Deliberate, recorded order of application | `[MIDDLEWARE]` | Percentages and fixed amounts give different answers in different orders |
| Charges separated by which side of tax they fall on | `[MIDDLEWARE]` | Taxable charges before, non-taxable after |
| The resolved stack carried onto the order | `[MIDDLEWARE]` | Stored as it was shown, not recomputed when the order is read |
| The same build-up available away from the storefront | `[MIDDLEWARE]` | The figures quoted in person match the ones quoted online |

## commercetools

**Entities:** `Cart`, `LineItem`, `CustomLineItem`, `CartDiscount`, `DiscountCode`, `TaxCategory`, `TaxRate`, `Order`, `Type`

**Verified API surface**

- (concept) A Cart Discount has a stackingMode field of Stacking or StopAfterThisDiscount controlling whether further Cart Discounts can apply after it, which is distinct from the Project-level discountCombinationMode governing how Product Discounts and Cart Discounts interact — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/cart-discounts/how-cart-discounts-work)
- (concept) Whether a price is net or gross is a property of the Tax Rate through includedInPrice, and after calculation the Cart's taxedPrice exposes both totalNet and totalGross — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-b2b-pricing/net-and-gross-prices-and-tax)
- (concept) Custom Line Items can be added to a Cart with their own money amount, their own tax rate and their own price mode, which is how a charge that is not a catalog product is stated on the order in its own right — [docs](https://docs.commercetools.com/api/carts-orders-overview)

**Constraints that change the design**

- All Cart Discounts must have a rank, and rank determines the processing order which impacts the final Cart total — a 10% discount then a fixed 5 off a 100 subtotal gives 85, while the reverse order gives 85.50, so the sequence is a monetary decision and not a presentation one — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/cart-discounts/how-cart-discounts-work)
- A Total Price discount applies last regardless of its sort order and ignores the StopAfterThisDiscount stacking mode of other Cart Discounts, so a discount targeting the total cannot be positioned freely within an itemized sequence — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/cart-discounts/how-cart-discounts-work)
- The Project-level discountCombinationMode defaults to Stacking, applies to every Cart in the Project, and cannot be varied per Cart — so a single project cannot run best-deal pricing for one market and stacked pricing for another — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/cart-discounts/how-cart-discounts-work)
- commercetools has no concept of an organizational level that granted a discount: Cart Discounts carry a rank and a name, so the attribution of each contribution to a level in a distribution chain is Custom Field data the platform stores but does not interpret — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/cart-discounts/how-cart-discounts-work)

**Modeling notes**

Rank is the mechanism and it is more load-bearing than it looks — it is not a tie-breaker, it is the arithmetic. Allocate rank bands per level of the chain rather than per discount, so that a national discount always resolves before a local one and adding a new discount does not silently reorder the existing ones. Write the expected total for a representative configuration as a test and keep it, because a rank collision is invisible until somebody notices the money. Two platform behaviors will bite a design that assumes free ordering: a discount targeting the cart total always applies last whatever its rank, so express a mid-stack deduction against line items rather than the total; and discountCombinationMode is a project-wide setting, so a network that wants stacked pricing in one market and best-deal in another needs that difference expressed in the discount definitions, not in configuration. Model charges as Custom Line Items with their own tax rate, and let the tax boundary fall out of includedInPrice rather than arithmetic you do yourself — the taxedPrice gives you both sides once the rates are right. Finally, persist the itemized stack onto the order as data at the moment it is placed. It is tempting to rebuild it for display from the discounts that applied, and it works until a discount is retired or its name changes, after which historic orders quietly start describing themselves differently.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-storefront`, `commercetools-platform`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- What is the authoritative order of application between levels, and who owns it when two levels collide?
- Which charges are taxable in each market, and who maintains that classification?
- May a lower level's discount ever exceed a ceiling set above it, and what happens if it does?
- How long must the itemized build-up be retained on an order, and in what form for audit?

---

_Excluded for B2B2C: Self-applied vouchers entering the same stack._

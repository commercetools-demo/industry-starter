<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# A minimum charge taking over when the computed total is lower

## Purpose

Sending a vehicle, a crew or a technician costs the same whether it collects one item or twenty, so industrial sellers set a floor below which the job is not worth doing. Buyers accept the floor and object to discovering it: a total that jumps at checkout with no explanation reads as an error, while the same number shown next to the computed alternative reads as a policy. Making the comparison visible also changes buyer behavior in the seller's favor, because a buyer who can see they are paying the minimum will add the lines that get them past it.

## Requirements

### Requirement: A minimum charge taking over when the computed total is lower

Where a minimum charge applies, the system SHALL charge the greater of that minimum and the computed total for the items it covers, and show the buyer both figures and which of the two was applied.

#### Scenario: Minimum applies
- **GIVEN** a covered scope whose computed total is below its minimum charge
- **WHEN** the buyer views the cart
- **THEN** the minimum is charged, and both the computed total and the minimum are shown with the minimum identified as applied

#### Scenario: Computed total applies
- **GIVEN** a covered scope whose computed total exceeds its minimum charge
- **WHEN** the buyer views the cart
- **THEN** the computed total is charged, the itemized breakdown is shown, and the minimum is not added on top of it

#### Scenario: Outcome flips as the cart changes
- **GIVEN** a cart currently priced at the minimum
- **WHEN** the buyer adds enough lines to exceed it
- **THEN** the charge switches to the computed total and the change is shown, without the buyer reloading or restarting

#### Scenario: Shortfall visible
- **GIVEN** a cart priced at the minimum
- **WHEN** the buyer views the comparison
- **THEN** the amount still available before the minimum is exceeded is stated

#### Scenario: Minimum scoped not global
- **GIVEN** a cart containing two covered scopes each with its own minimum, and lines covered by neither
- **WHEN** the cart is priced
- **THEN** each minimum is evaluated against only its own covered items, and uncovered lines neither contribute to nor are affected by either

#### Scenario: Discounts and the floor
- **GIVEN** a promotional discount applied to covered items that takes the computed total below the minimum
- **WHEN** the cart is priced
- **THEN** the order of evaluation is applied consistently and the buyer is shown the resulting charge and which figure it came from

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Minimum charge attached to the covered scope | `[MIDDLEWARE]` | Per service, site or visit — declared, not hard-coded per product |
| Computed total for the covered items | `[MIDDLEWARE]` | Itemized so the comparison can be checked |
| The comparison and its outcome | `[MIDDLEWARE]` | Both figures, and which one is being charged |
| Shortfall to the minimum | `[MIDDLEWARE]` | How much more would have to be added to clear it |
| Minimum recomputed as the cart changes | `[MIDDLEWARE]` | The outcome flips both ways as lines are added and removed |
| Outcome recorded on the order | `[MIDDLEWARE]` | Which figure was charged, and why |

## commercetools

**Entities:** `Cart`, `CustomLineItem`, `LineItem`, `CartDiscount`, `DirectDiscount`, `Order`, `Type`

**Verified API surface**

- (concept) addCustomLineItem charges for something that is not represented as a Product Variant, such as an installation fee or a partner-provided service, which is how a minimum charge enters the cart as an inspectable line rather than a hidden adjustment — [docs](https://docs.commercetools.com/learning-implement-carts-and-shopping-lists/implement-carts/update-carts)
- (concept) Custom Fields declared through a Type let the computed total, the minimum and the applied outcome be recorded on the Cart and carried onto the Order, which is what makes the charge defensible after the fact — [docs](https://docs.commercetools.com/api/projects/carts)

**Constraints that change the design**

- commercetools has no minimum-order-value or greater-of price type: the comparison is computed outside price selection and the outcome written to the cart, because the platform will not evaluate one total against another — [docs](https://docs.commercetools.com/api/pricing-and-discounts-overview)
- Cart Discounts are evaluated in a fixed order — line item targets, then gift line items, then non-participating Direct Discounts, then shipping cost, then cart total price — and sort order and stacking mode are effective only among discounts with those targets, so a floor implemented as a discount competes inside that ordering rather than sitting outside it — [docs](https://docs.commercetools.com/api/pricing-and-discounts-overview)
- Under best-deal selection the platform calculates the cart total twice, once with the Product Discount and once with the Cart Discounts, and applies whichever yields the lower cart total — a mechanism that chooses the lower total and therefore cannot express a floor that chooses the higher one — [docs](https://docs.commercetools.com/api/pricing-and-discounts-overview)

**Modeling notes**

Do not try to express this with discounts. The platform's best-deal mechanism exists to pick the lower of two totals and there is no inverse, so a floor built out of Cart Discounts fights a fixed evaluation order and a fixed tie-break, and the result is unpredictable the first time a promotion lands in the same cart. Compute the comparison in middleware and write the outcome as a Custom Line Item — a separate top-up line when the minimum applies, removed when it stops applying — and keep both input figures in Custom Fields so the cart can explain itself without recomputation. The recomputation trigger is the part that gets missed: the outcome flips in both directions on every quantity change, every line removal and every discount application, so treat the cart as read-after-write and re-evaluate on each, rather than only on the way into checkout. Decide and write down whether the floor is evaluated before or after discounts; either is defensible, but only one can be implemented.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Is the minimum evaluated before or after promotional discounts, and who owns that decision?
- What scope does a minimum cover — a service, a visit, a site, or an order?
- May a minimum be waived, by whom, and is the waiver recorded on the order?

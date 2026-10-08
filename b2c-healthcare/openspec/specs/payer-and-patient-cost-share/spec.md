<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# What the scheme covers and what the recipient owes, before paying

## Purpose

Nearly everywhere else, a price is a number the seller sets and the buyer pays. Here it is the outcome of a three-party arrangement: a scheme has agreed to cover some of it, the recipient owes the rest, and neither figure is knowable from the catalog. The engine that decides the split is almost never the commerce platform — it is a claims system, a fund, a benefits administrator — and it has its own rules about the recipient's cover, their remaining contribution for the year, and which goods the scheme recognizes at all. What matters for the storefront is that a single total is not an answer. A recipient shown one number cannot tell whether the scheme has been applied, and will either abandon because the price looks wrong or complete and dispute the charge later; both outcomes cost more than showing two numbers. The other half of the requirement is that the resolved figures have to survive. Recomputing the split at checkout because a downstream service was called again is how a total changes between the page the recipient agreed to and the amount taken from their card, which in this setting is not a rounding complaint but a consent problem.

## Requirements

### Requirement: What the scheme covers and what the recipient owes, before paying

The system SHALL show, for every line whose price is set by a funding scheme, both the amount that scheme covers and the amount the recipient owes, resolved before any payment is taken.

#### Scenario: Covered line shows both figures
- **GIVEN** a recipient with a funding scheme and a line the scheme covers in part
- **WHEN** the line is priced
- **THEN** the covered amount and the amount the recipient owes are both shown against that line

#### Scenario: Fully covered line
- **GIVEN** a line the scheme covers in full
- **WHEN** the line is priced
- **THEN** the amount owed is shown as nil and the covered amount is still stated

#### Scenario: Uncovered line in a covered basket
- **GIVEN** a basket mixing covered and uncovered lines
- **WHEN** the basket is totalled
- **THEN** the uncovered lines are marked as not covered, and the two totals are reported separately

#### Scenario: Basket change alters existing cover
- **GIVEN** a priced basket
- **WHEN** another line is added that changes the cover on a line already present
- **THEN** every affected line is re-resolved and the recipient is shown the new split before checkout

#### Scenario: Figures unchanged between review and payment
- **GIVEN** a recipient who has reviewed the split
- **WHEN** they proceed to payment
- **THEN** the amount taken equals the amount they were shown, or the order does not proceed

#### Scenario: Resolver unavailable
- **GIVEN** the funding scheme's engine cannot be reached
- **WHEN** pricing is attempted
- **THEN** the failure is reported as unresolved cover rather than defaulting to the unfunded price

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Funding scheme identified for the recipient | `[MIDDLEWARE]` | Established before pricing, not asked for at the payment step |
| Per-line resolution by the scheme's own engine | `[MIDDLEWARE]` | Cover is decided per item, not as a percentage of the basket |
| Covered amount stated separately from the amount owed | `[MIDDLEWARE]` | Two figures; one total hides whether the scheme applied at all |
| Uncovered lines marked as uncovered | `[MIDDLEWARE]` | Not covered is a result; unpriced is a failure, and they must look different |
| Re-resolution when the basket or the scheme changes | `[MIDDLEWARE]` | Adding a line can change the cover on lines already there |
| Resolved figures held as the price of record | `[MIDDLEWARE]` | The amount agreed on screen is the amount taken |
| Resolver failure answered rather than defaulted | `[MIDDLEWARE]` | Falling back to list price silently bills the recipient for everything |

## commercetools

**Entities:** `Cart`, `LineItem`, `CustomLineItem`, `Order`, `Payment`, `Type`, `TaxMode`, `Extension`, `Customer`, `CustomerGroup`

**Verified API surface**

- (concept) Price selection prioritises scopes in a fixed order in which Customer Group takes precedence over Channel, which takes precedence over country, and validity dates are checked at each step — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/price-calculation/price-selection)
- (update-action) changeTaxMode switches a Cart to External or ExternalAmount so that an outside service supplies the tax amounts, which is the same shape of handover a funding engine needs for price — [docs](https://docs.commercetools.com/learning-implement-carts-and-shopping-lists/implement-carts/update-carts)
- (concept) Custom Line Items can be added to a Cart with their own money amount and price mode, and can be changed with changeCustomLineItemMoney, which is how an amount not derived from a catalog product is stated on the order in its own right — [docs](https://docs.commercetools.com/api/carts-orders-overview)

**Constraints that change the design**

- Price selection only works for commercetools' internal pricing solution, Embedded or Standalone Prices; when using an external pricing solution the external price is added directly to the Line Item and overrides any Embedded or Standalone Price set for the Product Variant — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/price-calculation/price-selection)
- commercetools has no payer, coverage, benefit or cost-share concept; a Line Item carries one price, so the covered amount and the amount owed are two values the implementation computes and stores itself, and the platform will total only the one it was given — [docs](https://docs.commercetools.com/api/carts-orders-overview)

**Modeling notes**

Set the resolved amount owed as the external price on the Line Item and keep the covered amount beside it in Custom Fields. Resist the temptation to express cover as a Cart Discount: a discount is the seller giving something up, a covered amount is a third party owing money, and the two produce identical totals but completely different reconciliation. If the covered portion has to appear as its own figure on the order, a Custom Line Item is the honest representation, and it is the only line type whose money you can set directly. Be deliberate about when the funding engine is called. An API Extension on every cart update gives you correctness and puts a third party's latency in the path of every keystroke; a middleware call at defined points gives you speed and a window in which the cart is stale. Whichever you choose, re-resolve before order creation and compare, because cover frequently depends on the whole basket rather than the line, and the last line added is exactly the one that changes it. Treat resolver failure as a first-class outcome with its own state — the dangerous default is the quiet one, where an unreachable engine resolves to the unfunded list price and the recipient is charged for everything.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-checkout`, `commercetools-connect`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Which system owns the cover decision, and how long may a resolved split be treated as current?
- Is cover recalculated when the basket changes, or fixed at the moment each line was added?
- What happens when cover is revoked between order placement and fulfillment — who absorbs the difference?
- How is a recipient's remaining annual contribution surfaced, and by whom?

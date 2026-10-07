<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# The offer that would unlock a discount already within reach

## Purpose

Cross-service discounting only pays off if customers find it, and most do not: the discount for holding broadband alongside mobile is invisible to someone who came to buy mobile. The prompt worth making is a specific one — this offer, added to what you have, reduces your bill by this amount — because it is checkable, and a customer who checks it and finds it true adds the line. A generic recommendation is not the same thing and does not convert. The risk sits in the eligibility half: prompting someone toward a discount they cannot actually have is worse than staying quiet, because they will add the offer, watch the saving not appear, and lose confidence in every price on the page.

## Requirements

### Requirement: The offer that would unlock a discount already within reach

The system SHALL identify, from what a cart already holds, the offers that would activate a discount the customer is eligible for, and present each with the saving it would unlock.

#### Scenario: Reachable discount surfaced
- **GIVEN** a cart one qualifying offer away from activating a discount
- **WHEN** the customer views the cart
- **THEN** the offer that would activate it is presented with the saving it would unlock

#### Scenario: Saving is quantified
- **GIVEN** a suggested offer that activates a discount
- **WHEN** the suggestion is shown
- **THEN** it states the amount the customer would save rather than only that a discount exists

#### Scenario: Ineligible offer never suggested
- **GIVEN** a discount the customer is not eligible for
- **WHEN** suggestions are computed
- **THEN** no offer is suggested on the strength of that discount

#### Scenario: Suggestion is honoured when taken
- **GIVEN** a suggested offer presented with a stated saving
- **WHEN** the customer adds it
- **THEN** the discount applies and the total falls by the amount that was stated

#### Scenario: Satisfied discount not repeated
- **GIVEN** a discount that the cart already activates
- **WHEN** suggestions are computed
- **THEN** no further offer is suggested for that discount

#### Scenario: No reachable discount
- **GIVEN** a cart with no discount one offer away
- **WHEN** suggestions are computed
- **THEN** nothing is suggested, rather than an unrelated offer being promoted as a saving

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Cart contents as the input | `[MIDDLEWARE]` | What is already held decides what is worth suggesting |
| Discounts reachable from the current cart | `[MIDDLEWARE]` | One offer away, not any discount that exists |
| Customer eligibility applied to the suggestion | `[MIDDLEWARE]` | Never suggest an offer this customer cannot buy |
| The saving quantified | `[MIDDLEWARE]` | The amount, not the existence of a discount |
| Merchandiser-defined suggestions | `[CACHED]` | A curated pairing, with a predictable result |
| Suggestions withdrawn once satisfied | `[MIDDLEWARE]` | A discount already active is not a prompt |

## commercetools

**Entities:** `Cart`, `CartDiscount`, `DiscountCode`, `LineItem`, `CustomerGroup`, `Store`, `Product`

**Verified API surface**

- (concept) A Cart Predicate at Cart Discount level defines whether that Cart Discount can apply to a Cart: if the condition is met the discount applies, otherwise it is ignored for that Cart — so the predicate is the statement of what a cart would have to contain for the discount to activate — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/discount-codes/discount-codes-and-cart-predicates)

**Constraints that change the design**

- Cart Predicates are evaluated against a Cart to decide application; the platform offers no reverse operation that reports which predicates a Cart is close to satisfying or what would have to be added, so reachability has to be computed by the implementation — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/discount-codes/discount-codes-and-cart-predicates)
- Discounts are resolved as a best-deal selection across Product Discounts and Cart Discounts and the outcome can differ from any single discount considered alone, so the saving a suggested offer would produce cannot be read off that discount's own value and must be obtained by pricing the prospective cart — [docs](https://docs.commercetools.com/api/pricing-and-discounts-overview)
- A Cart Discount stackingMode of StopAfterThisDiscount prevents further Cart Discounts from applying, so adding an offer can activate one discount while suppressing another and leave the customer better off by less than the suggested discount's face value — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/cart-discounts/how-cart-discounts-work)

**Modeling notes**

Quote the saving from a priced prospective cart, never from the discount's configured value. Discounting resolves as a best-deal selection and stacking modes can suppress one discount when another applies, so the face value of the discount you are steering toward is not the number the customer will see — and this capability lives or dies on that number being right. Price a copy of the cart with the candidate offer in it and take the difference. That is expensive, which is the real design constraint: keep the candidate set small and curated rather than evaluating the whole catalog, and prefer merchandiser-defined pairings whose result is predictable and can be cached. Apply eligibility before pricing, not after, or you will spend the expensive step on offers the customer cannot buy. If suggestions are ever generated automatically rather than curated, treat the output as candidates to be verified by the same pricing step — an inferred pairing that does not survive being priced is not a suggestion, it is a broken promise.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Who curates the pairings, and how often are they reviewed against what is actually converting?
- How stale may a cached saving be before it must be repriced?
- Should a suggestion ever be shown when the customer would have to change an existing line rather than add one?

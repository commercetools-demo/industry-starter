<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# A shared discount code with an allowance per selling agent

## Purpose

Discretionary discounting is how connectivity is actually closed, and it is controlled by rationing rather than by approval: each agent may give away so much, and the code itself is common so that it can be communicated once and reported on as one campaign. The control only works if the count is kept per agent. Counted globally, the fastest-discounting agent consumes everyone's allowance in a week; not counted at all, the discretionary discount becomes the standard price and the margin assumption behind the campaign is gone. The awkward part is that the limit must bind at the moment of sale — an allowance discovered to be overspent in next month's reporting has already been given away, and nobody is going to claw it back from the customer.

## Requirements

### Requirement: A shared discount code with an allowance per selling agent

Where a discount code is shared across selling agents but allocated per agent, the system SHALL refuse the code once the agent applying it has exhausted their own allocation, while it remains valid for agents who have not.

#### Scenario: Within allowance accepted
- **GIVEN** an agent who has not exhausted their allocation of a shared code
- **WHEN** they apply the code
- **THEN** the discount applies and their remaining allowance is reduced by one

#### Scenario: Exhausted allowance refused
- **GIVEN** an agent who has consumed their entire allocation
- **WHEN** they apply the code
- **THEN** the code is refused for that agent and the reason given is their exhausted allowance, not an invalid code

#### Scenario: Code still valid for others
- **GIVEN** one agent who has exhausted their allocation
- **WHEN** a different agent applies the same code
- **THEN** it applies normally, because the allocation is per agent

#### Scenario: Counted on the order not the cart
- **GIVEN** an agent who applies the code to a cart that is then abandoned
- **WHEN** their remaining allowance is read
- **THEN** it is unchanged, because the allowance is consumed by a placed order

#### Scenario: Canceled order releases the allowance
- **GIVEN** an order that consumed an allocation and is then canceled
- **WHEN** the allowance is recomputed
- **THEN** the consumption is released and the agent may use it again

#### Scenario: No agent identified
- **GIVEN** a cart with no selling agent recorded on it
- **WHEN** an agent-allocated code is applied
- **THEN** it is refused, because there is no allocation to count it against

#### Scenario: Concurrent applications at the limit
- **GIVEN** an agent with one redemption remaining applying the code to two orders at once
- **WHEN** both are placed
- **THEN** only one consumes the final allocation and the other is refused

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| One code shared across agents | `[MIDDLEWARE]` | Communicated and reported as a single campaign |
| Allocation held per agent | `[MIDDLEWARE]` | How many redemptions that agent may make |
| The acting agent identified on the cart | `[MIDDLEWARE]` | Without this there is nothing to count against |
| Consumption counted on the order | `[MIDDLEWARE]` | A placed order, not an application to a cart |
| Exhausted allocation refused at application | `[MIDDLEWARE]` | Before the customer is quoted the discounted price |
| Remaining allowance visible to the agent | `[MIDDLEWARE]` | So the limit is managed rather than hit |
| Released consumption on cancellation | `[MIDDLEWARE]` | An order that never completed did not spend the allowance |

## commercetools

**Entities:** `DiscountCode`, `CartDiscount`, `Cart`, `Order`, `CustomObject`, `Extension`, `Type`

**Verified API surface**

- (concept) A Discount Code carries optional Max applications, the number of times it can be applied, and Max applications per customer, the number of times it can be applied per Customer — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/discount-codes/apply-discount-codes)
- (concept) Many Discount Codes can be associated with a single Cart Discount, so per-agent codes backed by one shared Cart Discount are an alternative to one shared code — at the cost of the code no longer being common — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/discount-codes/discount-codes-and-cart-predicates)
- (concept) A Discount Code cartPredicate acts as a gatekeeper controlling whether the associated Cart Discounts can even be considered for a Cart, and both the Cart Discount and Discount Code predicates must be met for the discount to apply — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/discount-codes/discount-codes-and-cart-predicates)
- (concept) An API Extension is called after a create or update request is processed but before the result is persisted, and can validate the object and respond with an error code such as InvalidInput, failing the call — [docs](https://docs.commercetools.com/api/projects/api-extensions)

**Constraints that change the design**

- The only redemption limits the platform offers are global and per Customer: commercetools has no concept of a selling agent, so an allocation held per agent has no native counter and must be maintained by the implementation — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/discount-codes/apply-discount-codes)
- A single Cart can have a maximum of 10 Discount Codes applied and a Discount Code can apply up to 10 Cart Discounts, which bounds any design that issues codes per agent per campaign — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/discount-codes/discount-codes-and-cart-predicates)

**Modeling notes**

There is no native counter for this, and the gap is specifically that the platform has no notion of a selling agent — maxApplications is global and maxApplicationsPerCustomer counts the buyer, which is the wrong party entirely. Two shapes work. Issue one code per agent against a shared Cart Discount and let maxApplications do the counting, which is robust and native but gives up the single common code the campaign wanted. Or keep the one code, record the acting agent on the cart, and hold the counter yourself in a Custom Object with an API Extension refusing the application once it is spent. The second matches the requirement and puts the correctness burden on you. If you take it, the detail that decides whether it works is where you count: increment on order placement, not on application to a cart, or abandoned carts will eat allowances that were never given away. That makes the check and the increment two separate moments with a gap between them, so an agent at their last redemption working two orders at once can spend it twice — settle whether that is acceptable, and if it is not, make the increment a conditional write that fails rather than a read-then-write. Reconciling releases on cancellation is a second job; decide up front whether it is automatic or a manual correction, because rebuilding the count from order history later is materially harder than maintaining it.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-connect`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Is the allocation per agent per campaign, per period, or a standing budget?
- Can an allocation be increased or transferred mid-campaign, and who authorizes that?
- Does a canceled or returned order release the allocation automatically, and after how long?
- How is the acting agent established in a channel where the customer completes the purchase themselves?

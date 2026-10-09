<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# What a price or discount rule would change, before it goes live

## Purpose

When several organizations in a chain can each author price rules over an overlapping catalog, nobody can hold the consequences in their head. A rule written as a condition — all vehicles of this grade, in these markets, above this specification — reads as a sentence and lands as a spreadsheet, and the author is usually a commercial person who knows exactly what they meant and has no way to see what they said. The failure this prevents is not a typo, it is a rule that is correct in isolation and catastrophic in combination: it collides with a rule from the level above, or it matches ten thousand configurations instead of ten, and the first symptom is a day of underpriced orders that were all legitimately placed and mostly cannot be unwound. Simulation is also what makes approval meaningful. Asking a manager to approve a discount rule expressed as a predicate is asking them to rubber-stamp it; asking them to approve a figure and a list of what moves is a decision they can actually take.

## Requirements

### Requirement: What a price or discount rule would change, before it goes live

The system SHALL report which products and prices a proposed price or discount rule would change, and what they would change to, evaluated against the live catalog before the rule is allowed to take effect.

#### Scenario: Simulation lists what moves
- **GIVEN** a proposed discount rule
- **WHEN** it is simulated
- **THEN** the products and price records it would affect are listed, with the resulting price for each

#### Scenario: Overbroad rule is visible before launch
- **GIVEN** a rule whose condition matches far more of the catalog than intended
- **WHEN** it is simulated
- **THEN** the scale of the match is reported before the rule can be published

#### Scenario: Collision with a higher level rule
- **GIVEN** a proposed rule overlapping one authored at a level above
- **WHEN** it is simulated
- **THEN** the overlap is reported along with which rule would prevail

#### Scenario: Simulation respects authority
- **GIVEN** an author with authority over one part of the network
- **WHEN** they simulate a rule
- **THEN** only products within their authority are evaluated and reported

#### Scenario: Approval sees the impact
- **GIVEN** a rule requiring approval before publication
- **WHEN** the approver opens the request
- **THEN** the simulated impact accompanies it rather than only the rule definition

#### Scenario: Stale simulation is refused
- **GIVEN** a simulation run before the catalog changed
- **WHEN** publication is attempted against it
- **THEN** it is refused and a fresh simulation is required

#### Scenario: No effect is also an answer
- **GIVEN** a rule that would match nothing
- **WHEN** it is simulated
- **THEN** that is reported explicitly rather than as an empty success

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Rule evaluated without being published | `[MIDDLEWARE]` | Authored, simulated and only then made live |
| Affected products and price records enumerated | `[MIDDLEWARE]` | How many, and which — not just a count |
| Resulting price shown for what changes | `[MIDDLEWARE]` | Before and after, for a representative sample |
| Collisions with existing rules reported | `[MIDDLEWARE]` | Overlap with rules from other levels is the expensive case |
| Scope limited to the author's own authority | `[MIDDLEWARE]` | A simulation must not reveal another organization's catalog |
| Result attached to the approval request | `[MIDDLEWARE]` | The approver sees the impact, not the predicate |
| Publication refused until a current simulation exists | `[MIDDLEWARE]` | Stale against a changed catalog is the same as absent |

## commercetools

**Entities:** `CartDiscount`, `DiscountCode`, `ProductDiscount`, `StandalonePrice`, `Store`, `Product`, `Cart`, `CustomObject`

**Verified API surface**

- (concept) A maximum number of 10000 StandalonePrices per Product can be indexed for Product Search, and Standalone Prices are the mechanism when a Product needs more price records than the 100 Embedded Prices per Product Variant allow — [docs](https://docs.commercetools.com/api/limits)
- (concept) Like a Product, a Product Tailoring has staged and current data, so changes can be prepared as staged data and published separately — the platform's own example of authoring something before it is allowed to take effect — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/design-b2b-catalogs/product-tailoring-for-b2b)

**Constraints that change the design**

- Cart Discounts are recalculated each time a change is made to a Cart, such as adding or removing a Line Item — the evaluation point is a Cart, so there is nothing to ask a rule about its own reach and a simulation has to evaluate it against representative Carts or price records itself — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/cart-discounts/how-cart-discounts-work)
- The number of active Cart Discounts that do not require a Discount Code and are independent of any Store is limited to 100, with an overall limit of 100 plus 100 per Store in the Project — so a network where every selling node authors its own always-on discounts is bounded by how it is mapped onto Stores — [docs](https://docs.commercetools.com/api/limits)
- Rank determines the processing order of Cart Discounts and changes the final total, so two rules that overlap do not merely both apply — the order in which they apply is itself part of the outcome a simulation has to report — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/cart-discounts/how-cart-discounts-work)

**Modeling notes**

There is no dry-run endpoint, and asking for one misunderstands where discounts live: a Cart Discount is evaluated against a Cart, so the only honest simulation is to build carts and price them. Do exactly that. Keep a corpus of representative carts — one per market, per grade, per common configuration — priced nightly, and simulate by repricing the corpus with the candidate rule injected and diffing the totals. It is unglamorous and it is the only approach that accounts for rank, stacking and the interaction with rules somebody else authored. Hold the candidate rule as a Custom Object until it is approved, so an unpublished rule is not an inactive Cart Discount that somebody can flip on by accident. Two limits shape the design before the simulation does. Active Cart Discounts without a code are capped at a hundred plus a hundred per Store, so a large network cannot give every node a handful of always-on rules unless nodes map to Stores — work out that arithmetic before promising self-service discounting, because the ceiling arrives long before the business runs out of ideas. And because price records themselves are bounded per product, a rule that would materialise thousands of Standalone Prices needs its scale reported in the simulation, not discovered at publication. Finally, scope every simulation to the author's own authority. It is the same resolution as the catalog chain, and reusing it is what stops a simulation becoming a way to read a competitor's assortment.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-platform`, `commercetools-connect`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- How representative must the simulation corpus be before an approver can rely on it?
- How long does a simulation stay valid, and what change to the catalog invalidates it?
- Who approves a rule that collides with one authored at a different level, and which prevails?
- Is a simulation required for a rule that only narrows an existing discount, or only for new spend?

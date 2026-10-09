<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# One price per service territory, unchanged through checkout

## Purpose

Where a machine sits or a service is performed changes what it costs to deliver — labor rates, haulage, disposal levies and local regulation all vary — so the same catalog line carries thousands of legitimately different prices. The buyer cares about none of that: they need one number that does not move between the page they chose on and the page they pay on. A price that changes at checkout is read as a bait-and-switch whatever the reason, and internal vocabulary leaking into the storefront is how a buyer learns there was a cheaper zone.

## Requirements

### Requirement: One price per service territory, unchanged through checkout

The system SHALL resolve the buyer's location to exactly one service territory and present the price for that territory identically on listing, detail, cart and checkout, without exposing the territory, price list or resolution mechanism to the buyer.

#### Scenario: Same price on every surface
- **GIVEN** a buyer whose location has resolved to a territory
- **WHEN** they move from listing to detail to cart to checkout
- **THEN** the same price is presented on each, and no surface shows a price resolved for a different territory

#### Scenario: Territory changes and prices follow
- **GIVEN** a buyer who changes the location the order is for
- **WHEN** the change is submitted
- **THEN** prices are re-resolved for the new territory across the cart and the change is stated, rather than some lines keeping the old territory's price

#### Scenario: Internals never surfaced
- **GIVEN** a territory carrying an internal code and price list name
- **WHEN** any buyer-facing surface renders a price
- **THEN** neither the code, the price list name nor the resolution mechanism appears in what the buyer can see

#### Scenario: Unserved territory
- **GIVEN** a location in a territory where a service is not offered
- **WHEN** the buyer views that service
- **THEN** it is reported as not available at that location, rather than shown at another territory's price

#### Scenario: Ambiguous resolution
- **GIVEN** a location that maps to more than one territory
- **WHEN** resolution runs
- **THEN** the system treats it as unresolved and asks for a more precise location, rather than choosing one

#### Scenario: Display and cart disagree
- **GIVEN** a price displayed from a cached projection that has since changed
- **WHEN** the line is added to the cart
- **THEN** the cart's resolved price governs and the buyer is told it changed before they are asked to pay

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Location captured before anything is priced | `[STATIC]` | Postal code or site address, asked once |
| Location resolved to one territory | `[MIDDLEWARE]` | Exactly one; an ambiguous resolution is an error, not a choice of price |
| Territory price on listing and detail | `[CACHED]` | The same resolution as the cart will use |
| Territory price on cart and checkout | `[MIDDLEWARE]` | Re-resolved, and compared against what was displayed |
| Territory-driven surcharges shown separately | `[MIDDLEWARE]` | A levy is a line the buyer can see, not a silently higher unit price |
| Services not offered in the territory withheld | `[MIDDLEWARE]` | Unavailable is not the same as unpriced |
| No internal pricing vocabulary on any surface | `[STATIC]` | No territory code, price list name or engine identifier |

## commercetools

**Entities:** `Channel`, `Store`, `StandalonePrice`, `Product`, `ProductVariant`, `Cart`, `LineItem`, `CustomObject`

**Verified API surface**

- (concept) Distribution Channels are pricing pipelines — each Channel holds a set of Prices for your Products, and assigning specific Distribution Channels to Stores dictates the pricing strategy for that Store, which is how a territory becomes a price scope — [docs](https://docs.commercetools.com/learning-model-your-business-structure/stores-and-channels/manage-multiple-experiences-from-one-project)
- (concept) With the GraphQL productsSearch query, B2B scoping is two mechanisms: constrain which variants match using exact expressions on variants.prices.channel, and resolve the number shown by selecting the variant price field with the same channelId — filtering without resolving returns the right products with no price — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/discover-and-order-products-in-b2b/product-search-for-b2b-catalogs)

**Constraints that change the design**

- Price selection prioritises Customer Group over Channel and Channel over country, and falls back down a 17-step cascade to a Price with no scope at all — so a territory Price that is missing resolves to the open-range Price silently rather than failing — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/price-calculation/price-selection)
- Standalone Prices allow up to 50000 Prices per Product Variant, and Product Search indexes Standalone Prices only up to 10000 per Product, applying a sorting algorithm to offer a balanced selection beyond that — so territory counts above that range stop being reliably searchable by price — [docs](https://docs.commercetools.com/api/projects/product-search)
- Scoped Price search — filter, facet and sort by scoped price — works only with Embedded Prices and yields inconsistent results for Products in Standalone price mode, and it has no fallback behavior and ignores Price validity dates — [docs](https://docs.commercetools.com/api/pricing-and-discounts-overview)
- The Carts API determines the Line Item price independently of the Product Projections or search response, so display and cart are two separate price selections and will disagree whenever their scope arguments differ — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/price-calculation/price-selection)

**Modeling notes**

A territory is a Distribution Channel, and the postal-code-to-Channel mapping is data held outside the price — a Custom Object or an external service — because a Channel has no geographic model. The failure mode to design against is not a wrong price but a silent one: price selection walks a 17-step cascade and lands on the unscoped Price if the territory's Price is absent, so a missing territory Price looks like a working page at the wrong number. Guard it explicitly — resolve, then assert that the returned Price carries the Channel you asked for. At scale, check the counts before choosing the model: Standalone Prices give 50000 per variant but search indexes 10000 per Product, and Scoped Price search does not work for Standalone at all, so filtering or sorting by territory price is off the table above that range and belongs in an external index. Display and cart are two separate price selections; pass identical scope to both and compare the result before asking for payment.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-platform`, `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Which system owns the location-to-territory mapping, and how is a boundary change rolled out without a downtime window?
- How long may a resolved territory price be held for a buyer before it must be re-resolved?
- When a buyer's site sits on a territory boundary, who decides which territory applies?

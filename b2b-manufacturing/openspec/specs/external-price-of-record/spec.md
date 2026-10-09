<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Prices owned outside the platform, held steady on the cart

## Purpose

In this industry the price a buyer pays is frequently computed by the system that owns their account — a dealer management system, an ERP, a rate engine — and is per-buyer, per-part and recalculated continuously. Importing that into the catalog is not an option at the cardinality involved, so the commerce platform stops being the pricing authority. What it must still guarantee is stability: a buyer who priced a basket at nine o'clock and pays at ten has agreed to the nine o'clock number, and an external system that has moved on since cannot be allowed to reprice the agreement underneath them.

## Requirements

### Requirement: Prices owned outside the platform, held steady on the cart

Where the price of record for a part is held in an external system, the system SHALL resolve that price at read time and record the resolved value on the cart line, so the amount the buyer was shown is the amount they are charged even if the external system answers differently later.

#### Scenario: Resolved price governs
- **GIVEN** a part whose price of record is held in an external system
- **WHEN** the buyer adds it to the cart
- **THEN** the line carries the externally resolved price, and the catalog price attached to the variant does not apply

#### Scenario: Price moves after resolution
- **GIVEN** a cart line priced from the external system, whose source price has since changed
- **WHEN** the buyer reviews the cart
- **THEN** the line keeps the price it was resolved at, and any change is surfaced at the defined revalidation point rather than applied silently

#### Scenario: Source unreachable at display
- **GIVEN** the external pricing system is unreachable
- **WHEN** the buyer views a part
- **THEN** the part is shown as not currently priced and cannot be added, rather than being shown at a catalog fallback price

#### Scenario: Source unreachable at checkout
- **GIVEN** a fully priced cart and an external system that has become unreachable
- **WHEN** the buyer reaches the revalidation point
- **THEN** the resolved prices stand and the order may proceed, or checkout is blocked with a stated reason — never repriced from an unavailable source

#### Scenario: Sorting by price not offered from the catalog
- **GIVEN** an assortment priced externally
- **WHEN** the buyer sorts or filters a listing by price
- **THEN** the ordering comes from the same source that priced the lines, and is not derived from catalog prices that do not apply

#### Scenario: Resolution recorded on the order
- **GIVEN** an order placed from externally resolved prices
- **WHEN** the order is created
- **THEN** each line records which system priced it and when, so the amount can be defended later

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Price read from the external system at display | `[MIDDLEWARE]` | Per buyer and per part; not a catalog read |
| Resolved price written onto the cart line | `[MIDDLEWARE]` | The line carries the number, not a reference to recompute |
| Source and time of the resolution recorded | `[MIDDLEWARE]` | Which system answered, and when |
| Explicit state when the source is unreachable | `[STATIC]` | Unpriced, not zero and not the list price |
| Revalidation point before payment | `[MIDDLEWARE]` | One defined moment, with a stated tolerance |
| Filtering and sorting by price handled elsewhere | `[MIDDLEWARE]` | An external price cannot be searched on in the platform |

## commercetools

**Entities:** `Cart`, `LineItem`, `Order`, `Product`, `ProductVariant`, `Type`, `Extension`

**Verified API surface**

- (concept) External Prices are for cases including a high number of unique customer prices — B2B contexts with over 50000 customers each needing separate prices — and pricing data stored in an external system that must be called to retrieve a price for display or cart addition — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/price-calculation/types-of-prices)
- (update-action) An external price is set on the Line Item at creation or through Add LineItem, Remove LineItem, Change LineItem Quantity, Set LineItem Price or Set LineItem TotalPrice; with priceMode ExternalPrice set externalPrice and totalPrice is computed as price times quantity, with ExternalTotal set externalTotalPrice and totalPrice is taken from it — [docs](https://docs.commercetools.com/api/pricing-and-discounts-overview)

**Constraints that change the design**

- Price selection works only for Embedded or Standalone Prices; an external price is added directly to the Line Item and overrides any Embedded or Standalone Price set for the Product Variant — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/price-calculation/price-selection)
- External prices are not available on the Product Search API or the Product Projection Search API for filtering, faceting or sorting, because they are not part of the product catalog — [docs](https://docs.commercetools.com/api/pricing-and-discounts-overview)
- An API Extension runs after processing a create or update request but before the result is persisted, and affects the performance of the API it extends: if it fails the whole call fails, and if it takes a second longer the call takes a second longer — [docs](https://docs.commercetools.com/api/projects/api-extensions)
- An API Extension applies to API calls from all clients including commercetools' own, such as the Merchant Center, so pricing logic placed there runs for back-office operations as well as the storefront — [docs](https://docs.commercetools.com/api/projects/api-extensions)
- If Embedded or Standalone Prices have changed since an Order was created, editing the Order applies the updated prices to all Line Items even when the edit does not touch them, and Line Items with no price matching the Order's price selection criteria are removed during the edit — [docs](https://docs.commercetools.com/api/projects/order-edits)

**Modeling notes**

Choosing external prices is choosing to own price consistency yourself, and the two costs arrive immediately. First, search: the platform cannot filter, facet or sort on a price it does not hold, so either an external index carries the price or those controls come off the listing page — discovering this after the PLP is built is common and expensive. Second, fallback: there is no partial success, because an external price overrides whatever is on the variant, so a failed lookup that quietly lets price selection answer instead produces a plausible wrong number rather than an error. Make the unpriced state real and untransactable. Prefer resolving in your own middleware over an API Extension: an Extension is synchronous, its latency and its failures become the platform call's, and it fires for the Merchant Center too. Note also that Order Edits reprice every Line Item from Embedded or Standalone Prices, so an externally priced order edited later can have its lines repriced or dropped — treat editing such an order as a path that must be designed, not assumed.

## commercetools skills

Load `commercetools-connect` before implementing this capability. Supporting: `commercetools-commerce-patterns`, `commercetools-platform`. Any task generated from this spec carries `[SKILL: commercetools-connect]`.

## Open questions

- What availability does the external pricing system hold, and what does the storefront do outside it?
- How long may a resolved price be honoured, and who bears the difference when the source has moved?
- Does the external system price per buyer, per site, or per contract, and is one call enough for a listing page?

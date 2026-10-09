<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Product detail page showing the buyer's effective price

## Purpose

The detail page is where a buyer decides, so it is the page a wrong price costs the most on. A variant can carry many prices at once - list, customer-group, channel-scoped, time-bound, tiered - and only one of them is the buyer's. Showing the list price beside a contract price, or ignoring the tier the buyer's quantity has already crossed, produces a total at checkout that does not match the page the buyer agreed to.

## Requirements

### Requirement: Product detail page showing the buyer's effective price

The system SHALL present, for the selected variant, the single price the requesting buyer would pay at the quantity they intend to order, including any volume tier that applies at that quantity.

#### Scenario: Quantity crosses a tier
- **GIVEN** a variant priced with volume tiers
- **WHEN** the buyer raises the quantity past a tier boundary
- **THEN** the displayed unit price and line total change to the tier price before the item is added to the cart

#### Scenario: No price resolves
- **GIVEN** no price matches the buyer's currency, context and validity window
- **WHEN** the detail page renders
- **THEN** the page states that the price is on request and the add-to-cart action is unavailable rather than defaulting to a list price

#### Scenario: Variant out of stock
- **GIVEN** the selected variant has no available quantity for the buyer's supply location
- **WHEN** the detail page renders
- **THEN** the unavailability is stated, with the restock information the inventory record carries if any

#### Scenario: Quote instead of cart
- **GIVEN** a buyer whose role permits requesting a quote
- **WHEN** the buyer chooses to request a quote for the variant and quantity
- **THEN** the variant and quantity are carried into a quote request and the active cart is left untouched

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Product image gallery | `[CACHED]` | Asset URLs from product data |
| Product name, SKU and brand | `[CACHED]` | Catalog master data |
| Short and long description | `[CACHED]` | Catalog or CMS copy |
| Variant selector | `[CACHED]` | Variant attributes from catalog |
| Standard or list price | `[CACHED]` | Base price, shared |
| Contract or negotiated price | `[MIDDLEWARE]` | Customer-group or contract-specific pricing |
| Volume or tiered pricing table | `[MIDDLEWARE]` | Per-customer tier rules |
| Stock availability indicator | `[MIDDLEWARE]` | Real-time inventory |
| Delivery estimate | `[MIDDLEWARE]` | Depends on buyer's shipping address plus inventory location |
| Add to Cart and Add to List actions | `[MIDDLEWARE]` | Write operations on session cart or account lists |
| Request Quote action | `[MIDDLEWARE]` | Write operations on session cart or account lists |
| Product attributes and technical specifications | `[CACHED]` | Catalog attributes |
| Downloadable assets (datasheets, safety data sheets) | `[STATIC]` | Static file links from PIM or DAM |
| Related and cross-sell products | `[CACHED]` | Merchandising rules, shared |
| Recently viewed | `[MIDDLEWARE]` | Session or user browsing history |
| Breadcrumb | `[CACHED]` | Category path from catalog |

## commercetools

**Entities:** `Product`, `ProductProjection`, `ProductType`, `StandalonePrice`, `CustomerGroup`, `Channel`, `InventoryEntry`, `QuoteRequest`, `ShoppingList`

**Verified API surface**

- (rest) The price-selection parameters priceCurrency, priceCountry, priceCustomerGroup and priceChannel on Product Projections add a single best-matching price field to each returned variant, which may be an Embedded or a Standalone Price; the prices array itself never contains Standalone Prices — [docs](https://docs.commercetools.com/api/product-catalog-overview)
- (concept) InventoryEntry carries restockableInDays and expectedDelivery as informational fields, plus minCartQuantity and maxCartQuantity boundaries that limit how many units a buyer may add — [docs](https://docs.commercetools.com/learning-model-your-product-catalog/inventory-modeling/inventory-management)

**Constraints that change the design**

- Price selection walks a fixed fallback order - Customer Group outranks Channel, which outranks country - and stops at the first level that matches. Currency and the validFrom/validUntil window are hard filters, so a price in another currency or outside its window is invisible rather than a fallback — [docs](https://docs.commercetools.com/api/pricing-and-discounts-overview)
- If the selected Price has PriceTiers, the tier valid for the Line Item quantity is used instead of the base Price - but the tiered price is ignored when the Price is already discounted by a Product Discount, so a promotion silently disables volume pricing — [docs](https://docs.commercetools.com/api/pricing-and-discounts-overview)
- ProductVariant.availability is an eventually consistent aggregate of the SKU's InventoryEntries and is documented as suitable for display, not for decisions; a binding availability check must read the InventoryEntry, which is strongly consistent for direct updates — [docs](https://docs.commercetools.com/api/inventory-overview)

**Modeling notes**

Resolve the price with the buyer's full context on every detail-page request and treat the catalog copy, gallery and attributes as the only cacheable part. If a buyer can see both a list price and their own price, decide deliberately which is authoritative on the page, because the cart will use the selected price and nothing else. Keep the tier table derived from the same Price object rather than a separate source, or the two will drift.

## commercetools skills

Load `commercetools-storefront` before implementing this capability. Supporting: `commercetools-commerce-patterns`, `commercetools-platform`. Any task generated from this spec carries `[SKILL: commercetools-storefront]`.

## Open questions

- What computes a delivery estimate for a buyer's address before a cart exists? commercetools carries restock information, not a per-address delivery date.
- Are datasheets and safety data sheets served as product assets or from a separate document system with its own access rules?

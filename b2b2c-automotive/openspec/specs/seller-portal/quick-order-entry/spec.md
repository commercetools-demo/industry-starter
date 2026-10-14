<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Quick order and bulk upload with per-line results

## Purpose

Procurement buyers submit hundreds of lines at once from a system of their own, and a cart write drops line items it considers invalid without raising an error, so a short cart is the normal failure mode rather than an exceptional one. Silently losing three lines of two hundred is discovered at goods-in, which is the most expensive place to discover it.

## Requirements

### Requirement: Quick order and bulk upload with per-line results

The system SHALL report, for every line of a submitted quick order or uploaded file, whether that line reached the cart and at what price, so a buyer is never left comparing the resulting cart against their own input to discover which lines failed.

#### Scenario: Every line resolved and priced
- **GIVEN** an uploaded file of codes the buyer's assortment covers, within available stock
- **WHEN** the buyer adds all lines to the cart
- **THEN** each line is reported as added with the resolved product name, quantity and the buyer's negotiated unit price

#### Scenario: Unknown code reported not guessed
- **GIVEN** a file containing a code that matches no product in the buyer's assortment
- **WHEN** validation runs
- **THEN** that line is reported unresolved with the submitted value echoed back, and the remaining lines stay available to add

#### Scenario: Line dropped by the platform
- **GIVEN** a line whose quantity exceeds available stock or whose price is no longer active
- **WHEN** the lines are written to the cart
- **THEN** the returned cart is compared against what was submitted and the missing line is reported with its reason, not omitted in silence

#### Scenario: Saved list carries no prices
- **GIVEN** the buyer saves the entry as a reusable list instead of adding it to the cart
- **WHEN** the list is reopened later
- **THEN** codes and quantities are preserved and prices are stated as resolved on conversion to a cart rather than shown from the list

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| SKU search field with inline resolution | `[MIDDLEWARE]` | Product lookup by SKU / part number |
| Multi-line entry table — product name | `[MIDDLEWARE]` | Resolved from SKU lookup |
| Multi-line entry table — price | `[MIDDLEWARE]` | Contract pricing per resolved product |
| CSV upload + column mapping | `[STATIC]` | Client-side parsing; validation is MIDDLEWARE |
| Validation feedback (unknown SKUs, OOS) | `[MIDDLEWARE]` | Inventory + catalog check |
| Add all to cart CTA | `[MIDDLEWARE]` | Bulk cart write |
| Save as list option | `[MIDDLEWARE]` | Write to account requisition lists |

## commercetools

**Entities:** `Cart`, `LineItem`, `ShoppingList`, `Product`, `ProductVariant`, `InventoryEntry`, `Channel`, `StandalonePrice`

**Verified API surface**

- (update-action) addLineItem takes a sku directly, and an added item matching an existing line on the merge-relevant fields increases that line's quantity instead of creating a second line - two rows of the same code in one upload therefore collapse into one line
 — [docs](https://docs.commercetools.com/learning-implement-carts-and-shopping-lists/implement-carts/update-carts)
- (update-action) addShoppingList copies every line item of a list onto a cart in one call and takes a distributionChannel, which sets that channel on each added line so it resolves the buyer's negotiated channel-scoped price
 — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/discover-and-order-products-in-b2b/shopping-lists-for-b2b-purchasing)

**Constraints that change the design**

- After every cart update the platform removes line items that have become invalid - deleted product, variant or price, an inactive StandalonePrice, or a quantity outside the associated InventoryEntry limits - so a bulk write can return fewer lines than were submitted with no error; diff the returned cart against the input
 — [docs](https://docs.commercetools.com/api/carts-orders-overview)
- A single update request accepts at most 500 update actions; batching all of them into one request is around 20 times faster in total than splitting them across 50 requests, while the cart document is hard-capped at 16 MB with 2 MB recommended and carts above 500 line items need monitoring
 — [docs](https://docs.commercetools.com/api/large-cart-performance-tips)
- Product Search documents SKU filtering only as a prefix expression on variants.sku, so a partial or mistyped code matches several variants; Product Projection Search offers the exact filter variants.sku:{sku}, which is what a code-entry pad needs
 — [docs](https://docs.commercetools.com/api/projects/product-search)
- Product Projection Search does not filter, facet or sort on Standalone Prices and can return inconsistent results for products in Standalone price mode - resolve identity from search and take the price from line item price selection on the cart
 — [docs](https://docs.commercetools.com/api/projects/product-projection-search)
- Price selection is not supported in the Shopping List context, so a ShoppingListLineItem has no price field - a saved requisition list cannot display negotiated prices until it becomes a cart
 — [docs](https://docs.commercetools.com/api/pricing-and-discounts-overview)
- A Shopping List holds at most 250 line items and 100 text line items, which caps a saved requisition list; B2B lists are created through /as-associate/{associateId}/in-business-unit/key={businessUnitKey}/shopping-lists and the business unit comes from the path, with any value in the body ignored
 — [docs](https://docs.commercetools.com/api/projects/shoppingLists)

**Modeling notes**

Run the page as three distinct passes and keep them separate in the UI: resolve codes to variants by exact SKU, validate quantity against inventory and price availability, then write. Batch the writes into requests of up to 500 actions and reconcile the returned cart against the submitted lines after every batch, because that reconciliation is the only place a dropped line becomes visible. Parse the file client-side but never trust it - the resolution and inventory verdicts are server-side. Prices belong to the cart, so the entry table's price column is either a preview fetched at the buyer's channel scope or blank until the write returns; do not read it from search.

## commercetools skills

Load `commercetools-storefront` before implementing this capability. Supporting: `commercetools-platform`, `commercetools-commerce-patterns`. Any task generated from this spec carries `[SKILL: commercetools-storefront]`.

## Open questions

- Does the buyer's own part number need to resolve alongside the seller's SKU, and where does that cross-reference live?
- What is the accepted maximum number of lines in one upload given the 500-action and cart-size guidance, and is a partially added cart acceptable or does the whole upload fail closed?
- Which file layouts and column orders must be accepted, and is a header row guaranteed?
- Should a line whose quantity exceeds stock be added at the available quantity, added in full for backorder, or refused?

<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Bulk and repeat ordering

## Purpose

A procurement buyer who already knows what they need experiences catalog browsing as an obstacle. These buyers place the largest orders, and a hundred-line requisition entered one product page at a time is the reason they stay on the phone or in a punch-out system instead.

## Requirements

### Requirement: Bulk and repeat ordering

The storefront SHALL let an experienced buyer assemble a large or repeat order from part numbers or a past order, without navigating the catalog product by product.

#### Scenario: Part numbers entered directly
- **GIVEN** a buyer with a list of part numbers
- **WHEN** the buyer enters or uploads them
- **THEN** each is resolved to a product at the company's price, and the whole set is added in one operation

#### Scenario: Unresolvable lines reported
- **GIVEN** an upload containing unknown part numbers and out-of-stock items
- **WHEN** validation runs
- **THEN** each problem line is named with its reason, and the valid lines are still addable

#### Scenario: Past order repeated
- **GIVEN** a previously placed order
- **WHEN** the buyer chooses to reorder it
- **THEN** a new basket is created from it at today's entitlements and prices, and any line that can no longer be bought is reported

#### Scenario: Basket frozen for review
- **GIVEN** a large basket awaiting internal sign-off
- **WHEN** the buyer freezes it
- **THEN** the agreed total cannot move under the reviewers while they consider it

## Pages

- [Landing page with session-resolved buyer context](../home-landing-page/spec.md)
- [Category listing with request-derived filter and page state](../product-listing-page/spec.md)
- [Search results with exact part-number resolution](../search-results-page/spec.md)
- [Order history scoped to what the buyer may see](../order-history/spec.md)
- [Saved and requisition lists with bulk add to cart](../saved-lists/spec.md)
- [Quick order and bulk upload with per-line results](../quick-order-entry/spec.md)

## commercetools

**Entities:** `Cart`, `Order`, `ShoppingList`, `RecurringOrder`, `Product`, `InventoryEntry`, `Channel`

**Verified API surface**

- (concept) Reorder a past purchase by replicating a Cart or an Order; use a Recurring Order instead only when the cadence is fixed and scheduled — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/implement-b2b-purchase-flows/the-b2b-cart)
- (update-action) Cart addShoppingList adds an entire saved list in one call, with distributionChannel to resolve negotiated prices — the bulk-entry path and the saved-list path converge here — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/discover-and-order-products-in-b2b/shopping-lists-for-b2b-purchasing)

**Constraints that change the design**

- Cart freeze has two strengths: SoftFreeze locks prices, HardFreeze also locks discounts and shipping. A freeze allows price-neutral edits while a lock blocks all edits — which is what makes buying-committee review possible without the total moving — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/implement-b2b-purchase-flows/the-b2b-cart)
- With shippingMode Multiple, quantities must be fully allocated across itemShippingAddresses; an unallocated quantity suppresses taxedPrice, so a multi-site bulk order with a partial allocation silently loses its tax total — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/implement-b2b-purchase-flows/the-b2b-cart)
- Punch-out procurement is supported by combining Product Selections, as-associate carts and Approval Flows through middleware; there is no built-in punch-out connector — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/implement-b2b-purchase-flows/the-b2b-cart)

**Modeling notes**

Resolve part numbers server-side in batch rather than one lookup per line, and validate the whole upload before mutating the cart — a half-added upload is worse than a rejected one. If the basket ships to several sites, allocate every quantity or the tax total silently disappears. Reorder is replication, not a recurring order; conflating them produces schedules nobody asked for.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Is punch-out from a customer procurement system in scope? It is middleware work, not configuration.
- What is the largest realistic requisition size, and does it exceed the shopping-list line limits?

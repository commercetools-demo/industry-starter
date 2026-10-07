<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Out-of-stock substitutions at picking time

## Purpose

Grocery baskets are picked hours after checkout from volatile fresh stock, so a material share of lines is unavailable at pick time. Without a per-line preference and an auditable post-placement record, the retailer either cancels profitable lines or substitutes without consent.

## Requirements

### Requirement: Out-of-stock substitutions at picking time

The system SHALL apply a substitution to a placed order only where the shopper's stored per-line preference or an explicit acceptance permits it, recording both products and the resulting price change on the order.

#### Scenario: Preference captured at line level
- **GIVEN** a cart containing a fresh-produce line item
- **WHEN** the shopper sets that line's preference to "allow similar"
- **THEN** the preference is persisted on the line item and survives onto the placed order

#### Scenario: Substitute applied within tolerance
- **GIVEN** a placed order has a line flagged "allow similar" that is unavailable at picking
- **WHEN** the picker selects a substitute within the configured price tolerance
- **THEN** the order reflects the substitute, both SKUs are recorded on the line, and the shopper is notified before delivery

#### Scenario: No substitute allowed
- **GIVEN** a placed order has a line flagged "no substitution"
- **WHEN** the item is unavailable at picking
- **THEN** the line is refunded or removed and no alternative product is added

#### Scenario: Outside tolerance needs consent
- **GIVEN** the only available substitute exceeds the configured price tolerance
- **WHEN** the picker proposes that substitute
- **THEN** the order is not modified until the shopper accepts, and removal is offered as the alternative

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Per-line substitution preference control | `[MIDDLEWARE]` | LineItem custom field; written per line on the session cart |
| Substitute suggestions on the line | `[CACHED]` | From the ProductType substitute-set attribute; shared across shoppers |
| Substitution notice before delivery | `[MIDDLEWARE]` | Triggered by the OrderEditApplied message |

## commercetools

**Entities:** `ProductType`, `Product`, `LineItem`, `Cart`, `Order`, `OrderEdit`, `InventoryEntry`, `Type`, `Channel`

**Verified API surface**

- (concept) A ProductType attribute of type set-of-reference(product) holds the substitute set, so merchandisers own it in Merchant Center — [docs](https://docs.commercetools.com/api/projects/productTypes)
- (update-action) Cart setLineItemCustomField stores the per-line substitution preference — [docs](https://docs.commercetools.com/api/projects/carts)
- (rest) Order Edits are the only supported path for a post-placement change that affects the order total: create the OrderEdit, add stagedActions (a dry run runs immediately and returns the order as if applied), review the preview, then Apply — [docs](https://docs.commercetools.com/api/carts-orders-overview)

**Constraints that change the design**

- An Order Edit can only be created when the InventoryMode of the Order and its LineItems is None - the Order Edits API does not track or reserve inventory — [docs](https://docs.commercetools.com/api/carts-orders-overview)
- Applying an Order Edit recalculates the order: if Embedded or Standalone Prices changed since placement, the updated prices apply to ALL line items even if the edit did not touch them, and discounts that are no longer valid are removed — [docs](https://docs.commercetools.com/api/projects/order-edits)
- The OrderEditApplied message carries the before and after net total, gross total and tax portion - use it as the audit record of the price effect — [docs](https://docs.commercetools.com/api/projects/order-edits)

**Modeling notes**

Substitution preference is a LineItem custom field (enum), not a cart-level flag - grocery shoppers decide per item. Post-placement substitution is a financial change, so it goes through Order Edits, never a direct order update. That forces InventoryMode: None on grocery orders, which directly conflicts with using ReserveOnCart to prevent overselling at checkout: a project cannot have both on the same order. Decide which matters more for this business before planning, and record the decision. The price-recalculation-on-apply behavior means the substitution flow must always show the preview totals rather than assume only the edited line changed.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Is the substitution price tolerance a fixed percentage per category, or a per-customer setting?
- Does this business need ReserveOnCart at checkout? If so, post-placement substitution cannot use Order Edits and needs a cancel-and-reorder flow instead.

---

_Excluded for B2C: Seller-scoped substitute assortment._

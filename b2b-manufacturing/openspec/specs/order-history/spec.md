<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Order history scoped to what the buyer may see

## Purpose

Order history is the highest-risk read in the account area, because the difference between "my orders" and "my company's orders" is an authorization decision and not a filter on a list. A buyer scoped to their own identity can never be shown a colleague's purchase, while an administrator who cannot see the team's orders has no way to reconcile spend, so both scopes have to be explicit.

## Requirements

### Requirement: Order history scoped to what the buyer may see

The system SHALL list only the orders the signed-in buyer is entitled to see: their own orders always, and other members' orders of the same organization only where their assigned role grants that visibility.

#### Scenario: Own orders only
- **GIVEN** a buyer whose role grants visibility of their own orders only
- **WHEN** they open order history
- **THEN** only the orders they placed are listed, filterable and paginated across the whole history rather than a fixed recent window

#### Scenario: Company wide with permission
- **GIVEN** an administrator whose role grants visibility of other members' orders
- **WHEN** they filter the list by another member or by cost center
- **THEN** that member's orders are listed with the same detail as their own

#### Scenario: Detail of an order not theirs
- **GIVEN** a buyer following a link to an order they are not entitled to see
- **WHEN** the detail page is requested
- **THEN** no order data is returned and the refusal is stated, rather than an empty order rendering

#### Scenario: Reorder with an unavailable item
- **GIVEN** a past order containing an item that can no longer be purchased
- **WHEN** the buyer reorders it
- **THEN** a new cart is created from that order and the unavailable item is reported to the buyer instead of being dropped silently

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Order list with filters | `[MIDDLEWARE]` | Paginated query against order history |
| Order summary rows | `[MIDDLEWARE]` | Order metadata |
| Order detail line items | `[MIDDLEWARE]` | Full order document |
| Shipment tracking links | `[MIDDLEWARE]` | Fulfillment service integration |
| Invoice download | `[MIDDLEWARE]` | Finance or document service |
| Reorder call to action | `[MIDDLEWARE]` | Adds past items to the current cart |
| Returns or RMA initiation | `[MIDDLEWARE]` | Write to the returns service |

## commercetools

**Entities:** `Order`, `Cart`, `Customer`, `BusinessUnit`, `AssociateRole`, `Store`

**Verified API surface**

- (rest) GET /{projectKey}/me/orders returns only the authenticated Customer's Orders; company-level history uses GET /{projectKey}/as-associate/{associateId}/in-business-unit/key={businessUnitKey}/orders, which requires the ViewMyOrders or ViewOthersOrders Permission and answers 403 AssociateMissingPermission without it — [docs](https://docs.commercetools.com/api/projects/associate-orders)
- (rest) Reorder is cart replication, not a dedicated action: replicating an existing Cart or Order produces a fresh active Cart the buyer then adjusts before checkout — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/implement-b2b-purchase-flows/the-b2b-cart)

**Constraints that change the design**

- The as-associate endpoints check membership and permission but do not validate the associateId and business unit in the URL against the token's scopes, so anyone who can call them can name any associate - they must only be reachable from trusted middleware that established the buyer's identity itself — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-associate-access/api-endpoint-patterns-for-b2b)
- The My Orders API has no write access at all and an Order cannot be changed through it once created, so a return raised from the storefront has to be written by a trusted service using the Order's Add ReturnInfo action — [docs](https://docs.commercetools.com/api/projects/me-orders)
- Return state is a fixed machine the storefront reflects rather than invents: ReturnShipmentState starts Advised or Returned and moves to BackInStock or Unusable, and ReturnPaymentState starts NonRefundable or Initial and moves to Refunded or NotRefunded — [docs](https://docs.commercetools.com/api/projects/orders)

**Modeling notes**

Settle the entitlement model before the UI: own-orders reads go through the me endpoints, company scope goes through as-associate with the role permission as the switch, and the page must not hold both behind one shared query. Cost center has no native field on an Order, so carry it as a custom field set at order creation and filter on it with a query predicate.

## commercetools skills

Load `commercetools-storefront` before implementing this capability. Supporting: `commercetools-commerce-patterns`, `commercetools-connect`. Any task generated from this spec carries `[SKILL: commercetools-storefront]`.

## Open questions

- Where do invoice documents live, and is the download proxied by the storefront tier or served as a signed link from the document service?
- Is cost center modeled as a division of the buyer organization or as an order custom field? The filter and the permission story differ between the two.

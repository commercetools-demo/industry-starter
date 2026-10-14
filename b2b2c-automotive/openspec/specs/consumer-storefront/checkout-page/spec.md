<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Checkout re-reading totals after each shipping change

## Purpose

Setting a shipping address or a shipping method makes the platform recalculate shipping cost, tax and the set of available delivery options. A checkout that keeps its own copy of the summary after such a change shows a total the order will not be created with, and the buyer discovers the difference on the confirmation page or the invoice. Re-reading is cheap; reconciling a disputed invoice is not.

## Requirements

### Requirement: Checkout re-reading totals after each shipping change

The system SHALL re-read the cart after every change to the shipping address or the delivery method and present the shipping cost, tax and order total from that response instead of the values shown before the change.

#### Scenario: Address change moves tax
- **GIVEN** a checkout with a summary already displayed
- **WHEN** the buyer switches to a delivery address in a different tax jurisdiction
- **THEN** the summary shows the recalculated tax, shipping cost and total, and any delivery option no longer valid for that address is withdrawn

#### Scenario: No delivery method for address
- **GIVEN** an address that no configured delivery method can serve
- **WHEN** the buyer reaches the delivery step
- **THEN** the absence of options is stated with what the buyer can change, and the step cannot be completed

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Progress stepper | `[STATIC]` | UI shell |
| Shipping address selector | `[MIDDLEWARE]` | Buyer's saved addresses from account |
| New address form | `[MIDDLEWARE]` | Writes new address to account |
| Delivery method options with costs and dates | `[MIDDLEWARE]` | Calculated from cart contents plus address plus carrier rules |
| Billing address selector | `[MIDDLEWARE]` | Account addresses |
| Payment method selector | `[MIDDLEWARE]` | Account's available payment methods (net terms, cards, purchase order) |
| Order notes field | `[STATIC]` | UI input |
| Order summary sidebar | `[MIDDLEWARE]` | Live cart summary including shipping and tax |
| Terms acceptance checkbox | `[STATIC]` | UI only |
| Place order action | `[MIDDLEWARE]` | Order submission to commerce backend |

## commercetools

**Entities:** `Cart`, `Order`, `ShippingMethod`, `Zone`, `TaxCategory`, `Payment`, `ApprovalRule`, `ApprovalFlow`, `BusinessUnit`, `Customer`

**Verified API surface**

- (rest) Before creating the order the cart must carry a shipping address, a shipping method, a billing address where required and linked payments; payment authorization must be complete for synchronous PSP flows, the latest cart version must be used, and your own business validations must have passed — [docs](https://docs.commercetools.com/learning-implement-checkout/custom-checkout/order-creation)

**Constraints that change the design**

- Setting a cart's shipping address or shipping method triggers automatic recalculation of shipping cost, taxes and available options - the storefront must re-read the cart after each or it shows mismatched totals. GET shipping-methods matching-cart returns only the methods valid for the current cart — [docs](https://docs.commercetools.com/learning-implement-checkout/custom-checkout/shipping)
- Approval governance evaluates Orders, not Carts: the predicate is an Order Predicate and the platform creates the Approval Flow only once the Order is placed and matches an active rule. Checkout can therefore warn that approval is likely, but cannot state the outcome before submission — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-approval-workflows/why-procurement-governance-matters)
- purchaseOrderNumber is native on the Cart and is inherited by the Order created from it, so set it during checkout on the cart rather than patching the order afterwards — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/implement-b2b-purchase-flows/the-b2b-cart)
- With shippingMode Multiple, taxedPrice is not calculated until every Line Item quantity is allocated across the registered itemShippingAddresses - an unallocated quantity is the usual cause of a checkout that shows no tax — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/implement-b2b-purchase-flows/the-b2b-cart)
- There is no update action to set the Store on an existing Cart - it must be set at creation, via in-store cart creation or CartDraft.store, so a checkout cannot correct the commercial context late — [docs](https://docs.commercetools.com/api/projects/carts)

**Modeling notes**

Make the summary sidebar a projection of the last cart response and never a locally maintained object. Fetch delivery options for the current cart rather than filtering a full method list in the client. Because approval is decided on the order, design the submit step to end in one of two outcomes - placed or submitted for approval - and make both first-class rather than treating the approval case as an error path.

## commercetools skills

Load `commercetools-storefront` before implementing this capability. Supporting: `commercetools-checkout`, `commercetools-commerce-patterns`. Any task generated from this spec carries `[SKILL: commercetools-storefront]`.

## Open questions

- Which system decides whether net terms or a credit line are available to this account at this total, and is that check synchronous within the checkout latency budget?
- Is delivery to multiple addresses in one order in scope, given that it changes when tax becomes calculable?

---

_Excluded for B2B2C: Purchase order number field; Cost center or budget code field; Approval routing notice._

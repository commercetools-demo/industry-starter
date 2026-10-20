<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Cart with engine-calculated totals after every change

## Purpose

Discounts are re-evaluated on every cart mutation, and a code that matched a moment ago can stop matching when a line is removed. Any total the storefront computes itself will therefore disagree with the total the order is created from, and the disagreement surfaces at the worst possible moment. Reading the engine's own numbers back after each write is the only way the cart page and the placed order can agree.

## Requirements

### Requirement: Cart with engine-calculated totals after every change

The system SHALL display the cart's subtotal, discounts, tax and total as returned by the commerce engine for the cart's current state after every line-item or discount change, never as a value calculated in the storefront.

#### Scenario: Discount stops applying
- **GIVEN** a cart with a discount code applied and a line item the code depended on
- **WHEN** the buyer removes that line item
- **THEN** the code is shown as no longer applicable with the reason, and the totals no longer include it

#### Scenario: Empty cart
- **GIVEN** a cart with no line items
- **WHEN** the buyer opens the cart page
- **THEN** the empty state is shown with a route back to browsing, and no summary block with zero totals

#### Scenario: Below minimum order value
- **GIVEN** a cart whose total is under the configured minimum order value
- **WHEN** the buyer views the cart
- **THEN** the shortfall is stated as an amount and the route to checkout is not offered

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Line items (image, name, SKU, quantity, unit price, line total) | `[MIDDLEWARE]` | Session cart state plus resolved pricing |
| Quantity editor and remove item | `[MIDDLEWARE]` | Writes to cart via middleware |
| Applied promotions and discount codes | `[MIDDLEWARE]` | Cart discounts evaluated server-side |
| Order summary (subtotal, shipping estimate, taxes, total) | `[MIDDLEWARE]` | Calculated by commerce engine |
| Minimum order value warning | `[MIDDLEWARE]` | Business rule evaluated against cart total |
| Save cart action | `[MIDDLEWARE]` | Write to account |
| Cross-sell suggestions | `[CACHED]` | Merchandising rules, product data |
| Empty cart state | `[STATIC]` | Static UI with call to action |

## commercetools

**Entities:** `Cart`, `LineItem`, `CartDiscount`, `DiscountCode`, `ShoppingList`, `QuoteRequest`, `BusinessUnit`, `Type`

**Verified API surface**

- (update-action) addShoppingList copies every Line Item of a Shopping List onto a Cart in one call and applies the given distributionChannel to the added lines, which is the mechanism behind a saved list becoming a cart at the right price — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/discover-and-order-products-in-b2b/shopping-lists-for-b2b-purchasing)

**Constraints that change the design**

- Cart Discounts are recalculated whenever a Discount Code, Line Item or Custom Line Item is added or removed, and again when the Order is created; an applied code can flip to the DoesNotMatchCart state, so the storefront must re-read discountCodes state after every mutation — [docs](https://docs.commercetools.com/api/pricing-and-discounts-overview)
- commercetools does not enforce a minimum order value. Business validations such as minimum order value and stock requirements are the implementation's responsibility, and a stale Cart needs an explicit recalculate action - with updateProductData set to true if variant prices must refresh too — [docs](https://docs.commercetools.com/learning-implement-checkout/custom-checkout/cart-preparation-and-review)
- purchaseOrderNumber is a native field on Cart, Quote Request, Staged Quote, Quote and Order and is inherited by whatever is created from the Cart; a per-line cost center has no native field and belongs on a Line Item Custom Field instead — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/implement-b2b-purchase-flows/the-b2b-cart)
- A Quote Request cannot be created from an anonymous Cart, a Cart carrying Discount Codes, or a Cart with shippingMode Multiple, and the Cart must have a shippingAddress - so the convert-to-quote action has to be gated on the cart's actual shape, not just on the buyer's role — [docs](https://docs.commercetools.com/api/quotes-overview)
- Cart writes are read-then-write on the cart version: always read the latest Cart before an update and verify the anonymousId or customerId matches the acting user, or concurrent edits from two tabs conflict — [docs](https://docs.commercetools.com/learning-implement-checkout/custom-checkout/cart-preparation-and-review)

**Modeling notes**

Treat every cart mutation as write-then-read and render from the response, not from local state. Minimum order value, per-line cost centers and any spend rule are your validations to write and to place consistently - if the cart page enforces them but checkout does not, buyers will find the gap. Keep the saved-cart concept on Shopping Lists rather than duplicating cart storage.

## commercetools skills

Load `commercetools-storefront` before implementing this capability. Supporting: `commercetools-commerce-patterns`. Any task generated from this spec carries `[SKILL: commercetools-storefront]`.

## Open questions

- Where is the minimum order value configured, and is it per store, per account or per currency?
- Is the list of valid cost centers held on the Business Unit, in an external finance system, or both?

---

_Excluded for B2C: Cost center or budget code selector per line; Convert cart to quote request._

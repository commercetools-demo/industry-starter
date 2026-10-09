<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Requisition and shopping lists

## Purpose

Procurement repeats. Rebuilding the same basket by hand each cycle is the friction B2B buyers most want removed, and in a procurement team the person who specifies what to buy is often not the person who buys it — so a list that only its creator can use solves half the problem.

## Requirements

### Requirement: Requisition and shopping lists

The storefront SHALL let a buyer keep named product lists for repeat and project purchasing, share them within their company, and turn one into a cart in a single step at the company's prices.

#### Scenario: List reordered in one step
- **GIVEN** a saved list a buyer reorders on a cadence
- **WHEN** the buyer converts it to a cart
- **THEN** every line is added in one operation at the company's negotiated prices

#### Scenario: Curator and buyer are different people
- **GIVEN** a list created by a procurement lead
- **WHEN** a division buyer opens it
- **THEN** the buyer can order from it without being able to edit it

#### Scenario: Own lists still visible
- **GIVEN** a buyer who can see colleagues' lists
- **WHEN** the buyer opens their own lists
- **THEN** their own lists are visible too, not hidden by the permission that granted access to others'

#### Scenario: Product no longer available
- **GIVEN** a saved list containing a product that has since been withdrawn
- **WHEN** the list is converted to a cart
- **THEN** the unavailable lines are reported rather than silently dropped

## Pages

- [Cart with engine-calculated totals after every change](../cart-page/spec.md)
- [Saved and requisition lists with bulk add to cart](../saved-lists/spec.md)

## commercetools

**Entities:** `ShoppingList`, `ShoppingListLineItem`, `Cart`, `BusinessUnit`, `Associate`, `AssociateRole`, `Channel`, `Store`

**Verified API surface**

- (rest) B2B shopping lists are created through POST /{projectKey}/as-associate/{associateId}/in-business-unit/key={buKey}/shopping-lists — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/discover-and-order-products-in-b2b/shopping-lists-for-b2b-purchasing)
- (update-action) Cart addShoppingList copies every line item from a list onto the cart in one call; pass distributionChannel on the action so each added line resolves the buyer's negotiated Channel-scoped price rather than an unscoped one — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/discover-and-order-products-in-b2b/shopping-lists-for-b2b-purchasing)

**Constraints that change the design**

- The Business Unit is taken from the URL path; any businessUnit field in the request body is ignored, so the list always belongs to the Business Unit that was addressed — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/discover-and-order-products-in-b2b/shopping-lists-for-b2b-purchasing)
- Shopping list access uses paired My/Others permissions and Others does not imply My; the endpoint also requires the manage_shopping_lists scope, and a missing permission returns 403 Forbidden — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/discover-and-order-products-in-b2b/shopping-lists-for-b2b-purchasing)
- A Shopping List holds at most 250 line items and 100 text line items, which bounds how large a requisition template can be — [docs](https://docs.commercetools.com/api/projects/shoppingLists)

**Modeling notes**

Decide who curates and who orders, then assign the My and Others halves of each permission accordingly — that decision, not the API, is what makes shared lists work. Forgetting distributionChannel on addShoppingList is the quiet failure here: the reorder succeeds and lands at the wrong price. A list converted to a cart is also the entry point to the quote flow.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Which roles curate lists and which only order from them?
- Do lists need to be scoped to a Store as well as a Business Unit?

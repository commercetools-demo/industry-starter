<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Saved and requisition lists with bulk add to cart

## Purpose

A named list only earns its place if converting it back into a cart is a single act; a buyer who reorders the same forty-line kit every month gains nothing from a list they have to re-key. The failure mode that matters is the silent one: a discontinued or de-assorted line dropped without comment is discovered at delivery, not at checkout, so the conversion has to be explicit about what it left behind.

## Requirements

### Requirement: Saved and requisition lists with bulk add to cart

The system SHALL add every line item on a saved list to the buyer's cart in one operation, naming any line it could not add and leaving the lines it did add in the cart.

#### Scenario: List converted in one operation
- **GIVEN** a saved list of twelve purchasable lines
- **WHEN** the buyer chooses to add the whole list to their cart
- **THEN** all twelve lines are in the cart at the prices that buyer is entitled to, and the list itself is unchanged

#### Scenario: Line no longer purchasable
- **GIVEN** one line on the list references a product that has left the buyer's assortment
- **WHEN** the buyer adds the whole list to their cart
- **THEN** the remaining lines are added and the excluded line is named with the reason it was excluded

#### Scenario: No lists yet
- **GIVEN** an account with no saved lists
- **WHEN** the buyer opens the lists page
- **THEN** the absence is stated plainly and a path to create a first list from the current cart is offered

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| List of saved lists | `[MIDDLEWARE]` | Account's list records |
| List detail with line items | `[MIDDLEWARE]` | List plus resolved product data |
| Line item prices | `[MIDDLEWARE]` | Price resolved at view time, including an account contract price where one applies |
| Add all to cart action | `[MIDDLEWARE]` | Bulk write to cart |

## commercetools

**Entities:** `ShoppingList`, `Cart`, `BusinessUnit`, `AssociateRole`, `Store`, `Channel`, `Customer`

**Verified API surface**

- (update-action) addShoppingList on the Cart copies every Line Item from the list onto the Cart in one call; passing distributionChannel on the action sets that Channel on each copied line so it resolves the buyer's negotiated Channel-scoped Price rather than an unscoped one — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/discover-and-order-products-in-b2b/shopping-lists-for-b2b-purchasing)
- (rest) Company lists are created and queried through /{projectKey}/as-associate/{associateId}/in-business-unit/key={businessUnitKey}/shopping-lists; the Business Unit is taken from the path and any businessUnit in the request body is ignored, and a missing Permission returns AssociateMissingPermission — [docs](https://docs.commercetools.com/api/projects/associate-shopping-lists)

**Constraints that change the design**

- A ShoppingListLineItem carries productId, variantId, quantity and an embedded variant but no selected price, and the Shopping List endpoints expose no price-selection query parameters - list prices have to be resolved separately against the buyer's Store and distribution Channel — [docs](https://docs.commercetools.com/api/projects/shoppingLists)
- A Shopping List holds at most 250 Line Items and 100 Text Line Items, so a requisition larger than that has to be split across several lists — [docs](https://docs.commercetools.com/api/projects/shoppingLists)
- Shopping List access in a Business Unit is governed by paired My and Others Associate Permissions, and Others never implies My: a role granted only ViewOthersShoppingLists sees colleagues' lists but not its own, which is the usual cause of a buyer seeing everyone's lists except their own — [docs](https://docs.commercetools.com/api/projects/associate-shopping-lists)
- The me endpoints do not validate View Permissions, so an associate can read anything reachable through them regardless of role - list visibility has to be enforced on the as-associate endpoints, not the me endpoints — [docs](https://docs.commercetools.com/api/associates-overview)

**Modeling notes**

Decide who curates a list and who orders from it before designing roles, then grant both halves of each My and Others permission pair deliberately. Create a company list through the as-associate and in-business-unit path so it belongs to the company rather than to whoever typed it, and scope it to the buyer's Store so it shares the commercial context of their carts. A list is a template, not a quotation: it holds no price, so the price shown on the detail page and the price that lands in the cart are two separate resolutions and can disagree if the channel differs.

## commercetools skills

Load `commercetools-storefront` before implementing this capability. Supporting: `commercetools-commerce-patterns`, `commercetools-platform`. Any task generated from this spec carries `[SKILL: commercetools-storefront]`.

## Open questions

- Where do list detail prices come from at view time - a price-selection read per line, or a throwaway cart? The first costs a round trip per render, the second creates carts the buyer never sees and never cleans up.
- Does a shared list need visibility narrower than the Business Unit, for example one project team within a division? Associate permissions are per role and per unit, not per list.
- What happens to a list line whose product is still purchasable but whose price has moved since the list was built - silently reprice, or surface the delta?

---

_Excluded for B2C: Share list with the account's users._

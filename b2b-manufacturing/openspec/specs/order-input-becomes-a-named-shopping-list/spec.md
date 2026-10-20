<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Order input becomes a named shopping list

## Purpose

Not every pasted list is an order being placed now. Recurring baskets, seasonal plans, and shared team lists need to be saved and reordered later, and a shopper who is forced to turn them into a cart has to build the list again every cycle. Supporting the list as a first-class outcome of the same intake path means one integration serves both "order this now" and "save this for every month", instead of two parsers that drift apart.

## Requirements

### Requirement: Order input becomes a named shopping list

The storefront SHALL create a named shopping list from a shopper's text or uploaded product list when a shopping list is the declared output entity.

#### Scenario: List input becomes a shopping list
- **GIVEN** input naming several products and a name for the list
- **WHEN** it is submitted declaring a shopping list as the output
- **THEN** a shopping list with that name is created, holding the matched products

#### Scenario: Missing list name is reported
- **WHEN** a shopping list request supplies no name for the list
- **THEN** the request fails with a machine-readable reason identifying the missing name, and nothing is created

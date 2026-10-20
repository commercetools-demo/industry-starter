<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Free-text order description becomes a cart

## Purpose

Shoppers arrive with the order already written down — pasted from an email, a spreadsheet column, a previous invoice, or a note on their phone. Without this, the storefront forces them to translate that list into search-and-add-to-cart, one product at a time, and most of them abandon somewhere in the middle. A team that skips it ends up building a bespoke quick-order parser per catalogue and discovers it cannot handle free-form descriptions, abbreviations, or product names that differ from the catalogue wording.

## Requirements

### Requirement: Free-text order description becomes a cart

The storefront SHALL create a cart from a shopper's free-text order description in a single request and return the created cart in the platform's standard representation.

#### Scenario: Free text becomes a cart
- **GIVEN** a shopper with a plain-text list of products and quantities
- **WHEN** that text is submitted as an intake request declaring a cart as the output
- **THEN** a cart exists containing one line item per matched product, each with the stated quantity

#### Scenario: Returned cart needs no translation
- **WHEN** the created cart is returned to the storefront
- **THEN** it can be read, displayed, and updated with the same code that handles a cart fetched directly from the platform

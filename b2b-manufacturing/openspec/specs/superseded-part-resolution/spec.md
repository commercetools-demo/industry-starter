<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# A withdrawn part number resolving to what replaces it

## Purpose

A part number is the durable name of a requirement, and the buyer's records, manuals and shelves keep the old one for decades after the maker has replaced it twice. Refusing the old number turns a solved problem into a phone call; silently substituting the new one produces a buyer who cannot reconcile the delivery note against their order. The chain matters as much as the endpoint, because replacements replace replacements and a single hop lands on a number that is also withdrawn.

## Requirements

### Requirement: A withdrawn part number resolving to what replaces it

The system SHALL accept a withdrawn part number, resolve it through its chain of replacements to the part currently supplied, and offer that part for order while showing the buyer which number they asked for and which they are getting.

#### Scenario: Single hop resolved
- **GIVEN** a part number withdrawn in favor of one replacement
- **WHEN** a buyer searches or quick-orders the withdrawn number
- **THEN** the replacement is offered, and both the requested and the supplied number are shown

#### Scenario: Chain walked to the end
- **GIVEN** a part number whose replacement has itself been replaced
- **WHEN** the withdrawn number is entered
- **THEN** the part currently supplied is offered, not the intermediate number that is also withdrawn

#### Scenario: Both numbers on the order
- **GIVEN** a line added by a withdrawn number
- **WHEN** the order is placed
- **THEN** the line records the number the buyer asked for alongside the part actually ordered

#### Scenario: One way replacement flagged
- **GIVEN** a replacement that supersedes the old part but is not accepted in its place
- **WHEN** the buyer views the result
- **THEN** the direction of the replacement is stated rather than presented as a straight swap

#### Scenario: One part replaced by several
- **GIVEN** a withdrawn part replaced by more than one part
- **WHEN** the withdrawn number is entered
- **THEN** the candidates are listed for the buyer to choose between rather than one being picked for them

#### Scenario: No replacement recorded
- **GIVEN** a withdrawn part with no replacement recorded
- **WHEN** the buyer enters its number
- **THEN** the system says the part is no longer supplied and no replacement is known, rather than returning nothing

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Withdrawn numbers accepted by search and quick order | `[MIDDLEWARE]` | The old number is an alias, not a missing product |
| Chain walked to the part currently supplied | `[MIDDLEWARE]` | Repeated hops resolved, not one |
| Both numbers shown on the result | `[CACHED]` | What was asked for and what is supplied |
| Replacement carried on the ordered line | `[MIDDLEWARE]` | The line records the number the buyer searched for |
| Direction of replacement stated | `[CACHED]` | A replacement is not always interchangeable in both directions |

## commercetools

**Entities:** `Product`, `ProductType`, `ProductVariant`, `Cart`, `LineItem`, `Order`, `Type`

**Verified API surface**

- (concept) Attribute Definitions on the Product Type are where a part's alternative identifiers live, so a set-of-text attribute holding withdrawn numbers makes the old number a searchable property of the current part rather than a separate product — [docs](https://docs.commercetools.com/learning-model-your-product-catalog/attribute-types-and-attribute-groups/attribute-types)
- (concept) Custom Fields declared through a Type carry the requested part number on the Cart Line Item and through to the Order line, which is what makes a substitution reconcilable after delivery — [docs](https://docs.commercetools.com/api/projects/carts)

**Constraints that change the design**

- commercetools has no supersession, replacement or cross-reference relationship between Products: the chain is either an attribute on the part or a lookup in the parts-catalog system of record, and the platform will not walk it — [docs](https://docs.commercetools.com/api/projects/products)
- Product Search only indexes the current representation of a Product, so a replacement recorded on a staged Product is not findable until the Product is published — [docs](https://docs.commercetools.com/api/projects/product-search)
- Product Search queries only Locales configured in the Project, and a query for an unconfigured Locale returns no results — which silently empties alias lookup for a market added to the storefront but not to the Project — [docs](https://docs.commercetools.com/api/projects/product-search)

**Modeling notes**

Model withdrawn numbers as searchable aliases on the current part, not as products of their own: a withdrawn part that still exists as a Product will appear in listings, accumulate prices and be orderable, and no amount of storefront filtering reliably keeps it out. Keep the chain walk outside the catalog — the platform holds no relationship between two Products and will not follow one, so either flatten the chain into the alias set at import time or resolve it in the parts system and pass the endpoint SKU to search. Flattening at import is usually right and has one trap: when a replacement is itself replaced, every alias upstream of it has to be re-pointed, so the flattening has to be recomputed rather than appended to. Record the requested number on the line at add-to-cart, because after delivery it is the only evidence of what the buyer actually asked for.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-platform`, `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Which system owns the replacement chain, and is it flattened there or at import?
- Is a replacement interchangeable in both directions, and is that recorded per link?
- When a part is replaced by several, who decides which one a given unit takes?

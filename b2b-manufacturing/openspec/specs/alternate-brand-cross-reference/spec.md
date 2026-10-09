<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Rival-brand equivalents named without their price or stock

## Purpose

A buyer arrives holding a competitor's number because that is what came off the machine, and a seller who cannot answer that question loses the line. The constraint is the point: a cross-reference table is commercially sensitive in one direction only, so the equivalence may be published while the rival's price and stock — which the seller may hold for other reasons — must not be. Building the lookup without that boundary turns a sales tool into a competitor price list.

## Requirements

### Requirement: Rival-brand equivalents named without their price or stock

The system SHALL let a buyer search by a part number belonging to another manufacturer and return the equivalent part it can supply, without disclosing any price or availability held for the other manufacturer's part.

#### Scenario: Rival number resolves to supplied part
- **GIVEN** a part number belonging to another manufacturer that has a recorded equivalent
- **WHEN** the buyer searches that number
- **THEN** the equivalent part the seller supplies is returned with its own price and availability

#### Scenario: Rival price never disclosed
- **GIVEN** the seller holds price or stock data for the other manufacturer's part for its own purposes
- **WHEN** a cross-reference result is requested by any client
- **THEN** no price and no availability for the other manufacturer's part is returned, whatever the request asks for

#### Scenario: Equivalence strength shown
- **GIVEN** an equivalence recorded as a functional alternative rather than a direct match
- **WHEN** the buyer views the result
- **THEN** the strength of the equivalence is stated rather than presented as identical

#### Scenario: No equivalent recorded
- **GIVEN** a rival part number with no recorded equivalent
- **WHEN** the buyer searches it
- **THEN** the system says no equivalent is recorded, rather than returning an unrelated result

#### Scenario: Browse excludes the other brand
- **GIVEN** a cross-reference set covering parts the seller does not supply
- **WHEN** a buyer browses or filters the catalog
- **THEN** only parts the seller supplies appear, and the other manufacturers' numbers surface only as a lookup

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Other manufacturers' numbers accepted by search | `[MIDDLEWARE]` | A recognized identifier, not a catalog entry |
| Equivalent supplied part returned | `[MIDDLEWARE]` | Priced and stocked normally, as any other part |
| Requested number echoed on the result | `[CACHED]` | So the buyer can see the match was understood |
| No price or availability for the other part | `[STATIC]` | Enforced server-side, not by omitting a field from a template |
| Strength of the equivalence stated | `[CACHED]` | Direct equivalent, functional alternative, or partial |

## commercetools

**Entities:** `Product`, `ProductType`, `ProductVariant`, `ProductSelection`, `Store`, `StandalonePrice`, `InventoryEntry`

**Verified API surface**

- (concept) A set-of-text Attribute Definition on the part Product Type holds the identifiers a part is findable by, so another manufacturer's number is a searchable attribute of the part the seller supplies — [docs](https://docs.commercetools.com/learning-model-your-product-catalog/attribute-types-and-attribute-groups/attribute-types)
- (concept) Product Selections scope which Products a Store's buyers see and can be inclusion- or exclusion-based, which is how parts that exist for cross-reference purposes are kept out of a storefront's browsable assortment — [docs](https://docs.commercetools.com/learning-model-your-business-structure/stores-and-channels/apply-stores-and-channels)

**Constraints that change the design**

- Product Search supports searching across Stores and Product Selections up to 15000 per Product as a soft limit, and exceeding it returns non-deterministic results rather than an error — [docs](https://docs.commercetools.com/api/projects/product-search)
- Standalone Prices are queried through their own API independently of Products, so excluding a Product from a Store's assortment does not stop a client reading the Prices attached to its SKU — withholding a competitor price is an authorization decision, not an assortment one — [docs](https://docs.commercetools.com/api/pricing-and-discounts-overview)
- The InventoryEntry sku field does not have to correspond to an existing Product, so stock can be held against a competitor part that is not in the catalog at all — and is readable by any client with inventory scope — [docs](https://docs.commercetools.com/learning-model-your-product-catalog/inventory-modeling/inventory-management)

**Modeling notes**

The equivalence belongs on the part being sold, as a searchable alias attribute; the rival part should not exist as a Product at all if the only reason for it is the cross-reference, because a Product that exists can be priced, stocked and found. Where the rival part must exist — because the seller genuinely trades it elsewhere — remember that Standalone Prices and Inventory Entries are readable through their own endpoints regardless of assortment scoping, so the non-disclosure has to be enforced by the token scope the storefront client holds and by a middleware that projects the response, not by leaving a field out of a template. A storefront that calls the platform directly with a broad scope cannot implement this capability.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-platform`, `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Which equivalences may be published, and who signs that off per manufacturer?
- Is the cross-reference data licensed, and does the license permit showing it to buyers?
- When an equivalence is only partial, what does the buyer have to be told for the sale to be defensible?

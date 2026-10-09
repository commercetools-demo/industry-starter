<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Parts resolved from the identity of one built unit

## Purpose

Two machines of the same model built weeks apart carry different parts, because the configuration was chosen per unit at build time. A buyer holding a serial number is asking a question the catalog cannot answer from product attributes alone: the answer lives in the as-built record held by manufacturing and engineering. Getting this wrong is not a poor search result, it is a part that does not fit, returned at the seller's cost, with the machine still down.

## Requirements

### Requirement: Parts resolved from the identity of one built unit

The system SHALL resolve a serial identifier for one built unit into the set of parts recorded against that unit's own configuration, and offer only those parts as fitting it, so a buyer never has to judge fitment from a description.

#### Scenario: Identifier resolves to fitting parts
- **GIVEN** a buyer holding the serial identifier of a unit they own
- **WHEN** they enter that identifier
- **THEN** only the parts recorded against that unit's configuration are offered as fitting it, grouped by assembly

#### Scenario: Same model different units
- **GIVEN** two units of the same model whose as-built configurations differ
- **WHEN** each identifier is entered in turn
- **THEN** each returns its own parts list, and a part fitting one is not offered for the other

#### Scenario: Identifier not recognized
- **GIVEN** an identifier the as-built system of record does not hold
- **WHEN** the buyer enters it
- **THEN** the system says the unit is not recognized and offers catalog search instead, rather than returning an unfiltered result set

#### Scenario: As built source unavailable
- **GIVEN** the as-built system of record is unreachable
- **WHEN** a buyer enters an identifier
- **THEN** the storefront says fitment cannot be confirmed right now and does not present unverified parts as fitting

#### Scenario: Unit carried onto the line
- **GIVEN** a part added to the cart from a unit's fitting list
- **WHEN** the order is placed
- **THEN** the line carries the unit identifier it was chosen for, through to the order

#### Scenario: Order by part number still open
- **GIVEN** a part that the resolved configuration does not list
- **WHEN** the buyer enters its part number directly
- **THEN** the part can still be ordered, and is not presented as fitting the unit

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Serial identifier entry | `[STATIC]` | Accepts the several identifiers in circulation for one unit |
| Identifier resolved to a configuration | `[MIDDLEWARE]` | Inbound from the as-built system of record; not held in commercetools |
| Fitting parts list for the resolved configuration | `[MIDDLEWARE]` | Grouped by assembly so a buyer can navigate the machine, not the catalog |
| Assembly diagram reference per group | `[CACHED]` | An asset reference on the product or group, not commerce data |
| Add to cart from the fitting list | `[MIDDLEWARE]` | Carries the unit identifier onto the cart line |
| Fitting list exported or sent on | `[MIDDLEWARE]` | The list is a work document before it is an order |

## commercetools

**Entities:** `Product`, `ProductType`, `ProductVariant`, `ProductSelection`, `Store`, `Cart`, `LineItem`, `Order`, `Type`, `CustomObject`

**Verified API surface**

- (concept) A ProductType defines the Attribute types relevant to one category of products, so identifiers a part is searchable by (part number, noun-modifier code, assembly group) are modeled as Attribute Definitions on the Product Type rather than as free text — [docs](https://docs.commercetools.com/learning-model-your-product-catalog/attribute-types-and-attribute-groups/attribute-types)
- (concept) Product Search is ID-first — a raw search returns Product IDs and the data to render is fetched separately; the GraphQL productsSearch query does both in one request, which is how a resolved parts list is hydrated for display without a second round trip — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/discover-and-order-products-in-b2b/product-search-for-b2b-catalogs)
- (concept) Custom Fields declared through a Type let a resolved unit identifier be carried on the Cart Line Item and through to the Order line, which is what makes a line traceable to the machine it was ordered for — [docs](https://docs.commercetools.com/api/projects/carts)

**Constraints that change the design**

- commercetools has no as-built bill-of-materials resource and no fitment model: the unit-to-parts relationship is held in the manufacturing, engineering or parts-catalog system of record and must be resolved outside the platform, with commercetools holding the part and the order — [docs](https://docs.commercetools.com/learning-model-your-product-catalog/inventory-modeling/inventory-management)
- Product Search supports searching across Stores and Product Selections up to 15000 per Product, and these limits are soft: exceeding them makes the API return non-deterministic results rather than an error, so a fitment set must not be modeled as one Product Selection per unit — [docs](https://docs.commercetools.com/api/projects/product-search)
- Product Search does not return tailored product data; where a seller's own content for a part differs from the manufacturer's, the Get ProductProjection in Store endpoints must be used instead — [docs](https://docs.commercetools.com/api/projects/product-search)

**Modeling notes**

Decide early that commercetools is not the fitment authority, because every alternative eventually fails on volume: a Product Selection per unit or a Store per unit collides with the 15000-per-product soft limit, and a non-deterministic result set is worse than an error because nothing reports it. The workable shape is a resolver in front of search — the identifier goes to the as-built system, which answers with part numbers, and those become an SKU-constrained Product Search whose prices and assortment are still scoped the normal way. That makes the as-built system's availability a storefront dependency, so decide up front what the page does when it is down; presenting the whole catalog as "parts for this unit" is the failure this capability exists to prevent. Keep the resolved identifier on the line as a Custom Field rather than in the line's name, so it survives onto the order and can be read back by fulfillment and warranty processes.

## commercetools skills

Load `commercetools-platform` before implementing this capability. Supporting: `commercetools-connect`, `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-platform]`.

## Open questions

- Which system owns the as-built configuration, and what read latency does it hold at the volume a listing page needs?
- How stale may a resolved configuration be before it must not be shown as fitment?
- When a unit has been modified since it was built, which record wins — as-built or as-serviced?
- Are the several identifiers in circulation for one unit resolved by the storefront or by the system of record?

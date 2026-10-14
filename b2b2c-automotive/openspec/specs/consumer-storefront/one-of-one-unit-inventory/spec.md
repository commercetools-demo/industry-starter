<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Stock where every unit is unique and the quantity is always one

## Purpose

Used and pre-built vehicles break the assumption underneath most commerce catalogs, which is that a product is a template and stock is a number against it. Here every unit is its own product: this car, with this mileage, this history, this specification, standing at this site, available from this date. Quantity is always one, which sounds like a simplification and is the opposite — it means the catalog turns over completely as stock moves, that search has to rank across tens of thousands of one-off records rather than a few thousand templates, and that the interesting browsing question is not "which model" but "what can I have, and when". Availability date is part of the product rather than a delivery detail, because a unit that arrives in six weeks is a genuinely different offer from the same specification standing on a forecourt today, and buyers sort on exactly that. The consequence that hurts if it is missed is the one-shot nature of the sale. With a template product an oversell is an apology and a backorder; with a one-of-one unit there is no second one, so two buyers who both got to the end of a checkout is a problem with no good resolution and it has to be prevented rather than handled.

## Requirements

### Requirement: Stock where every unit is unique and the quantity is always one

The system SHALL offer each individual vehicle as its own sellable item carrying its own identity, specification and date of availability, discoverable across the whole network and capable of being sold exactly once.

#### Scenario: Each unit listed on its own terms
- **GIVEN** two vehicles of the same model with different mileage and specification
- **WHEN** they are listed
- **THEN** each appears as its own item with its own specification, price and availability date

#### Scenario: Availability date is searchable
- **GIVEN** a shopper who needs a vehicle within a given period
- **WHEN** they search
- **THEN** results can be constrained and ordered by date of availability, including units not yet arrived

#### Scenario: Whole network searched
- **GIVEN** units held at several sites across the network
- **WHEN** a shopper searches
- **THEN** units from every site are returned, each stating where it stands

#### Scenario: Concurrent buyers on one unit
- **GIVEN** two shoppers attempting to buy the same unit at the same moment
- **WHEN** both submit
- **THEN** exactly one succeeds and the other is told the unit is gone, before taking their money

#### Scenario: Sold unit disappears everywhere
- **GIVEN** a unit sold through one channel
- **WHEN** it is next searched for through any channel
- **THEN** it is no longer offered

#### Scenario: New stock appears quickly
- **GIVEN** a unit newly added by a site
- **WHEN** a shopper searches shortly afterwards
- **THEN** it is discoverable, with its availability date

#### Scenario: Unit withdrawn and returned
- **GIVEN** a unit taken off sale and later put back
- **WHEN** it reappears
- **THEN** it is the same unit with its history intact rather than a new record

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| One record per physical unit | `[CACHED]` | Its own identity, not a variant of a model |
| Specification recorded per unit | `[CACHED]` | As built and as it stands now, including condition and history |
| Date of availability as a browsing criterion | `[CACHED]` | Including units that have not arrived yet |
| Units contributed by many parts of the network | `[MIDDLEWARE]` | Several sources injecting and withdrawing continuously |
| Sold once, and gone everywhere at once | `[MIDDLEWARE]` | Concurrency prevented, not reconciled afterwards |
| Location and holder of the unit visible | `[MIDDLEWARE]` | Where it stands decides who can deliver it and when |

## commercetools

**Entities:** `Product`, `ProductVariant`, `InventoryEntry`, `Channel`, `Store`, `Cart`, `LineItem`, `Order`, `Type`

**Verified API surface**

- (concept) The InventoryEntry is the source of truth for the stock level of a specific Product Variant at a given location or Channel, with quantityOnStock, availableQuantity and a supplyChannel identifying which Channel supplies it — [docs](https://docs.commercetools.com/learning-model-your-product-catalog/inventory-modeling/inventory-management)
- (concept) Informational fields restockableInDays and expectedDelivery on the InventoryEntry support display of estimated restock times, and Custom Fields can carry additional inventory information such as storage locations — [docs](https://docs.commercetools.com/learning-model-your-product-catalog/inventory-modeling/inventory-management)

**Constraints that change the design**

- A Product can only have 100 Product Variants in the classic catalog model and it is generally better to have more Products with fewer Product Variants — so one-of-one stock is modeled as a Product per unit, and the catalog grows and shrinks with the stock itself — [docs](https://docs.commercetools.com/learning-model-your-product-catalog/product-modeling/products)
- Changes to availableQuantity and quantityOnStock under the ReserveOnOrder, TrackOnly and ReserveOnCart inventory modes are eventually consistent and may take up to 10 seconds to appear — [docs](https://docs.commercetools.com/api/inventory-overview)
- Reservations are guaranteed regardless of the eventual consistency delay, because the reservation logic acquires stock from an internal real-time SKU availability collection, so stock checks and reservations are accurate at the time they are made even while the visible quantity lags — [docs](https://docs.commercetools.com/api/inventory-overview)
- For non-critical availability display the ProductVariant availability field may lag real-time stock by a few seconds and accurate data requires querying the InventoryEntry, so a listing page and a checkout must not be allowed to disagree about whether a one-of-one unit is still there — [docs](https://docs.commercetools.com/api/inventory-overview)

**Modeling notes**

A Product per unit, one variant, one SKU, quantity one. It feels wasteful and it is correct: variants are capped at a hundred per product and are the wrong axis anyway, since these units do not vary along a dimension, they are simply different. Accept that the catalog is now a high-churn dataset rather than a slowly-changing one, and design the feed for that — units arrive, change price, get withdrawn and sell, continuously, from several sources at once. The concurrency question is the one to get right first, and the good news is that the platform already solves it: reservations are taken against an internal real-time availability collection and are guaranteed even though the visible quantity is eventually consistent for up to ten seconds. So reserve on cart or on order and trust the reservation, but do not trust availableQuantity as a display value in the last few seconds before checkout — the listing page may legitimately still show a unit that has just gone, and the checkout has to be the place that says so. Use the supply channel to say where the unit stands, because that is what decides delivery and which part of the network can act on it. Put the availability date on the unit as an attribute the shopper can sort and filter on rather than leaving it as a fulfillment estimate, and keep a stable key per physical unit so that a vehicle withdrawn and relisted is recognisably the same one rather than a new record with a new history.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-platform`, `commercetools-connect`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- How quickly must a sale at one site remove a unit from every other channel?
- Who owns the unit record while it is in transit between sites, and can it be sold during that time?
- How long is a withdrawn unit's history retained, and does relisting reset its time on the market?
- Are units ever listed by more than one part of the network at once, and how is that de-duplicated?

---

_Excluded for B2B2C: Withdrawal and return without losing the record._

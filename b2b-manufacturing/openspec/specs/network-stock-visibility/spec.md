<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Stock across own and upstream locations, scoped per buyer

## Purpose

A part sitting in the seller's own bin, in a sister branch and in the manufacturer's distribution center are three different promises, and collapsing them into one number makes the most useful case — order it from the depot that has it today — impossible to express. Which locations a given buyer may be served from is a commercial arrangement, and how precisely stock is disclosed is a commercial choice: an exact count invites a competitor to read the seller's inventory, while an availability label is enough for the buyer to decide.

## Requirements

### Requirement: Stock across own and upstream locations, scoped per buyer

The system SHALL report availability for a part from each stocking location the buyer is entitled to draw from, whether that location belongs to the seller or to the upstream supply network, at the precision the seller has chosen to disclose.

#### Scenario: Breakdown by location
- **GIVEN** a part held at the seller's own location and at an upstream distribution center
- **WHEN** a buyer views it
- **THEN** availability is shown per location, each stating how current it is, alongside an aggregate across the locations that buyer may draw from

#### Scenario: Entitlement limits the locations
- **GIVEN** two buyers of the same seller entitled to different sets of stocking locations
- **WHEN** each views the same part
- **THEN** each sees only the locations they may be served from, and neither sees the other's

#### Scenario: Precision follows configuration
- **GIVEN** a location configured to disclose availability as a label rather than a count
- **WHEN** any buyer views stock at that location
- **THEN** the label is returned and the underlying count is not, for every client

#### Scenario: Freshness differs by source
- **GIVEN** a local figure read minutes ago and an upstream figure read hours ago
- **WHEN** both are shown
- **THEN** each carries its own currency, rather than one timestamp covering both

#### Scenario: Order more than is shown
- **GIVEN** a required quantity larger than the availability shown at any single location
- **WHEN** the buyer orders that quantity
- **THEN** the order is accepted with the shortfall identified, rather than the quantity being capped at the visible figure

#### Scenario: Upstream source unavailable
- **GIVEN** the upstream network's stock service is unreachable
- **WHEN** a buyer views a part
- **THEN** local availability is still shown and the upstream figure is reported as unknown rather than as zero

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Stock per stocking location | `[MIDDLEWARE]` | One record per part and location, never one blended figure |
| Upstream network stock alongside the seller's own | `[MIDDLEWARE]` | Inbound from the manufacturer's system; a different freshness from local stock |
| Locations a buyer may draw from | `[MIDDLEWARE]` | Set per buyer, not per storefront |
| How current the figure is | `[MIDDLEWARE]` | Local and upstream figures age at different rates and must say so |
| Aggregate view across entitled locations | `[MIDDLEWARE]` | Offered as well as the breakdown, never instead of it |
| Order beyond the visible quantity | `[MIDDLEWARE]` | A shown figure is not a ceiling on what may be ordered |

## commercetools

**Entities:** `InventoryEntry`, `Channel`, `Store`, `Product`, `ProductVariant`, `Cart`, `Order`

**Verified API surface**

- (concept) The InventoryEntry supplyChannel field indicates the Channel that supplies the stock, which is what enables separate tracking per warehouse, branch or supplier rather than one blended quantity per SKU — [docs](https://docs.commercetools.com/learning-model-your-product-catalog/inventory-modeling/inventory-management)
- (concept) Supply Channels are inventory pipelines, each Channel representing a single inventory source such as a warehouse, physical store or dropshipping supplier, and linking them to Stores is what scopes which stock a shopping context sees — [docs](https://docs.commercetools.com/learning-model-your-business-structure/stores-and-channels/manage-multiple-experiences-from-one-project)
- (concept) InventoryEntry carries restockableInDays and expectedDelivery as informational fields supporting display of estimated restock times, which is how a shortfall is expressed without a stock figure — [docs](https://docs.commercetools.com/learning-model-your-product-catalog/inventory-modeling/inventory-management)

**Constraints that change the design**

- quantityOnStock is the total stock level while availableQuantity reflects the portion available for sale after orders and reservations, so a storefront reading quantityOnStock shows stock that is already committed elsewhere — [docs](https://docs.commercetools.com/learning-model-your-product-catalog/inventory-modeling/inventory-management)
- A Store inherits inventory matching its assigned Supply Channels or inventory not assigned to any Channel at all, so an InventoryEntry left without a supplyChannel is visible in every Store — [docs](https://docs.commercetools.com/learning-model-your-business-structure/stores-and-channels/manage-multiple-experiences-from-one-project)
- minCartQuantity and maxCartQuantity on the InventoryEntry restrict how many units a customer can add, so using them to mirror a stock figure turns a display choice into a hard order ceiling — [docs](https://docs.commercetools.com/learning-model-your-product-catalog/inventory-modeling/inventory-management)

**Modeling notes**

One Supply Channel per stocking location, and never leave an InventoryEntry without one: an unassigned entry is inherited by every Store, which is the quiet way a branch's stock becomes visible to buyers who cannot be served from it. Read availableQuantity rather than quantityOnStock — the difference is the stock someone else has already committed, and showing it is how a promise gets made twice. Upstream network stock is a different kind of fact from local stock: it arrives on a slower cycle and is not reserved by anything the platform knows about, so either hold it as its own Supply Channel with an explicit freshness or keep it out of the platform entirely and read it at display time. Resist the temptation to enforce the displayed figure with maxCartQuantity; disclosure precision and order ceilings are different decisions and this industry routinely orders more than is on the shelf.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-connect`, `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Which system owns upstream network stock, how fast can it be read, and how stale may it be shown?
- Is a buyer's set of entitled locations held by the seller, the manufacturer, or both?
- Does a displayed availability figure carry any commitment, and for how long?

---

_Excluded for B2B: Disclosure precision per location._

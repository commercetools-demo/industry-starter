<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Remaining shelf life promised before buying, and kept afterwards

## Purpose

For dated goods the date is part of what is being bought. A sterile pack, a reagent, a nutritional product and a dressing all stop being usable on a known day, and a delivery that arrives with three weeks left is worthless to a department that turns its stock over quarterly — worse than an out-of-stock, because it has been paid for, occupies the shelf and will be written off. Buyers know this and have long-standing expectations expressed as a fraction of total shelf life remaining on receipt, which they will enforce by refusing the delivery if it is not met. That makes remaining life a term of the purchase rather than a logistics detail, and it has to be visible at the point the buyer chooses, because afterwards the only remedies are a return and a credit. There is a second, easier win in stating it: stock approaching its date is not worthless, it is worth less, and a buyer who consumes quickly will take it gladly if told what they are getting. Silence about the date forces the seller to treat short-dated stock as waste; saying it out loud turns it into a sale and a discount, with the expectation set honestly on both sides.

## Requirements

### Requirement: Remaining shelf life promised before buying, and kept afterwards

The system SHALL state the minimum remaining shelf life a buyer will receive before they commit to a dated product, and hold that promise through to what is actually supplied against the order.

#### Scenario: Remaining life shown before commitment
- **GIVEN** a dated product
- **WHEN** the buyer views it
- **THEN** the minimum remaining shelf life they will receive is stated before they add it

#### Scenario: Account minimum excludes unsuitable stock
- **GIVEN** an account requiring a minimum remaining life
- **WHEN** only stock below that threshold is held
- **THEN** the product is not offered to that account as normal stock, and the reason is available

#### Scenario: Short dated stock offered on its own terms
- **GIVEN** stock that cannot meet the standard promise
- **WHEN** it is offered
- **THEN** it is presented as short-dated with its actual expiry and its own price

#### Scenario: Supplied lot recorded
- **GIVEN** a fulfilled order for dated goods
- **WHEN** the order is read afterwards
- **THEN** the lot and expiry that were actually supplied are recorded on the line

#### Scenario: Stock ages before dispatch
- **GIVEN** an order placed against stock that met the promise at the time
- **WHEN** the promise can no longer be met at picking
- **THEN** it is raised before dispatch rather than discovered on receipt

#### Scenario: Mixed lots on one line
- **GIVEN** a quantity fulfilled from more than one lot
- **WHEN** it is supplied
- **THEN** each lot and its expiry are recorded, rather than one date standing for all of them

#### Scenario: Undated goods unaffected
- **GIVEN** products with no shelf life
- **WHEN** they are bought
- **THEN** no date is shown and nothing is recorded against them

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Remaining shelf life visible where the product is chosen | `[MIDDLEWARE]` | The minimum a buyer will receive, not the best lot in the building |
| Stock that cannot meet the promise excluded from the offer | `[MIDDLEWARE]` | Not sold and then rejected on the loading bay |
| Short-dated stock offered explicitly and separately | `[MIDDLEWARE]` | On its own terms and usually its own price |
| Lot and expiry recorded against what was supplied | `[MIDDLEWARE]` | The order says what arrived, not what was expected |
| Promise re-checked before dispatch | `[MIDDLEWARE]` | Stock ages between the order and the pick |

## commercetools

**Entities:** `InventoryEntry`, `Channel`, `ProductType`, `Product`, `Cart`, `LineItem`, `Order`, `Type`, `CustomObject`

**Verified API surface**

- (concept) The InventoryEntry custom field lets you add Custom Fields to store additional information relevant to your Inventory needs, for example batch numbers, expiry dates or storage locations — [docs](https://docs.commercetools.com/learning-model-your-product-catalog/inventory-modeling/inventory-management)
- (concept) To fulfill a single SKU from multiple inventory locations you can add multiple Line Items to the Cart, each specifying a different supply channel — [docs](https://docs.commercetools.com/api/inventory-overview)

**Constraints that change the design**

- Inventory tracks sellable stock per SKU across supply locations, and the InventoryEntry is the source of truth for the stock level of a Product Variant at a given location or Channel — so the native dimensions of availability are SKU and supply location, and a lot is not one of them — [docs](https://docs.commercetools.com/api/inventory-overview)
- Changes to availableQuantity and quantityOnStock under ReserveOnOrder, TrackOnly or ReserveOnCart inventory modes are eventually consistent and may take up to 10 seconds to appear, so a shelf-life filter computed from a just-read stock figure can be reading a stale picture — [docs](https://docs.commercetools.com/api/inventory-overview)
- For non-critical availability display the ProductVariant availability field may lag real-time stock by a few seconds, and accurate data requires querying the InventoryEntry — which is also where any expiry Custom Field lives, so a listing page cannot show a dated promise without that query — [docs](https://docs.commercetools.com/api/inventory-overview)

**Modeling notes**

Expiry is Custom Field data on the InventoryEntry, and the documentation names batch numbers and expiry dates as the intended use — but note what that does and does not give you. Availability is tracked per SKU per supply location, so one entry holds one set of custom values: if a location genuinely holds three lots of the same SKU with different dates and you need to sell against each separately, you are modeling lots as supply channels, and a cart can already carry one Line Item per supply channel. Do that only if you must; for most sellers the promise is a single worst-case date per location, which one entry expresses perfectly well and which is far cheaper to maintain. Keep the promise and the fact apart. What the buyer is shown before ordering is a commitment derived from stock and the account's contractual minimum; what goes on the order afterwards is the lot and date actually picked, and it arrives from the warehouse, not from the catalog. Do not overwrite one with the other. Two operational realities are worth designing for rather than discovering: a line is often filled from more than one lot, so the record has to hold a list and not a field; and the stock figures the filter reads are eventually consistent for up to ten seconds, which is fine for a listing and not fine as the last word before dispatch.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-connect`, `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Is the minimum remaining life expressed as a fraction of total shelf life or as an absolute period, and who agrees it?
- Which system is the record of truth for lot and expiry, and how quickly does it reach the storefront?
- What happens to an order already placed when the promise can no longer be met — substitute, part-ship, or cancel?
- May short-dated goods be returned at all, and does the remaining life at receipt change the answer?

---

_Excluded for B2C: Minimum acceptable life held per account; Returns bounded by the life remaining._

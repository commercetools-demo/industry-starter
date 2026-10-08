<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Seed catalog that exercises every telecom rule

## Purpose

Seed data is not filler. The storefront's hardest behaviours are compatibility refusals, included extras, term pricing and conflicting services, and a catalog without a case for each one means those behaviours are only ever tested by whoever happens to invent the right data by hand. The seed catalog is therefore specified as a set of named demonstration cases, each backed by concrete offers, so that a developer, a demo and an automated test all find the same router that cannot carry the top fiber speed and the same add-on that applies only to phone plans.

## Plan notes

**As built by workstream G (D-018, D-058).** 6 product types, 8 categories, 52 products (25 descriptive, 27 offers), 19 inventory entries, 6 cart discounts and the code `WELCOME10`, 5 demo customers and 3 demo orders. No Stores or Product Selections. EUR prices are the USD price rounded to whole euros. Demo order `MLV-DEMO-0003` totals 0 because the first-month-free discount applies (Q-010). Handset prices were replaced by workstream Q (M-Q-2).

## Requirements

### Requirement: Seed catalog that exercises every telecom rule

The system SHALL seed a catalog of Malva offers, add-ons and equipment, with prices, whose contents are sufficient to demonstrate each compatibility, inclusion, conflict and pricing behaviour the storefront specs describe.

#### Scenario: Every category has offers
- **GIVEN** a freshly seeded project
- **WHEN** each category in the tree is listed
- **THEN** each leaf and top-level category that is meant to hold offers returns at least two, so no listing renders empty in a demo

#### Scenario: Router unable to carry the top tier
- **GIVEN** the seeded entry-level router and the top cable tier
- **WHEN** their attributes are compared
- **THEN** the router's maximum supported speed is below the tier's downstream speed, which is the data that makes `configurable-offers-and-compatibility` refuse the pairing

#### Scenario: Add-on that applies to one family only
- **GIVEN** the seeded streaming and protection add-ons
- **WHEN** their applicable families are read
- **THEN** at least one applies to internet plans only and at least one to phone plans only

#### Scenario: Extra included at no charge
- **GIVEN** the seeded top cable tier
- **WHEN** its included add-ons are read
- **THEN** it names one add-on key that is also sold separately, so the "already included" behaviour has a case

#### Scenario: Two home internet services that cannot coexist
- **GIVEN** a seeded cable tier and a seeded home wireless tier
- **WHEN** their conflict declarations are read
- **THEN** each names the other family, so the exclusivity check has a symmetric case

#### Scenario: Term changes the price
- **GIVEN** any seeded plan tier
- **WHEN** its variants are read
- **THEN** it has a month-to-month variant and at least one committed-term variant with a lower monthly price

#### Scenario: Prices exist for the seeded market
- **GIVEN** every seeded variant
- **WHEN** its prices are read
- **THEN** each has a price in the seeded market's currency and country, and none is zero except where an item is deliberately free

#### Scenario: Offers wrap what is sold
- **GIVEN** a freshly seeded project
- **WHEN** the offer products are read
- **THEN** every sellable plan, add-on, equipment item and handset has an offer, at least one offer is limited to existing customers and one to a channel, and every key the offers reference exists

#### Scenario: Handsets seeded
- **GIVEN** a freshly seeded project
- **WHEN** the phones-and-devices category is listed
- **THEN** it holds at least two handsets, each with several color and memory variants, so `device-acquisition-mode` has outright, installment and lease cases on the same product

#### Scenario: Design prototype fully demonstrable
- **GIVEN** a freshly seeded project
- **WHEN** the storefront renders the home, phone, wireless, cable and add-ons pages from `design/source/Malva Telecom.dc.html`
- **THEN** every plan and add-on in the prototype exists with the name, price and tag the design shows, each design filter chip (phone: Unlimited / Data-capped; wireless: 5G / LTE; cable: Up to 500 Mbps / 1 Gbps) matches at least one plan, and the add-on filters Music, Video and Extras each match at least two add-ons

#### Scenario: Broadband Facts label data present
- **GIVEN** every seeded internet and phone plan
- **WHEN** the label inputs are read
- **THEN** typical download, upload and latency, data allowance, price-lock length, early-termination fee text and the one-time activation fee are present (cable has a $25 activation fee, wireless and phone $0)

## Seed offers

| Key | Category | Name | Notable attributes | Variants (term) |
| --- | --- | --- | --- | --- |
| `malva-cable-100` | cable-internet | Cable 100 | cable, 100 / 10 Mbps, typical 104 / 11 Mbps / 16 ms, $39.99 | month-to-month, 12, 24 |
| `malva-cable-500` | cable-internet | Cable 500 | cable, 500 / 50 Mbps, typical 525 / 48 Mbps / 13 ms, badge most-popular, $59.99 | month-to-month, 12, 24 |
| `malva-cable-gig` | cable-internet | Cable Gig | cable, 1000 / 60 Mbps, typical 940 / 60 Mbps / 11 ms, $79.99; includes `malva-appletv` | month-to-month, 12, 24 |
| `malva-wireless-lite` | home-wireless-internet | Air Lite | fixed-wireless, 4g (LTE), 50 Mbps, 300 GB, $45 | month-to-month, 12 |
| `malva-wireless-5g` | home-wireless-internet | Air 5G | fixed-wireless, 5g, 200 Mbps, unlimited, badge most-popular, $55 | month-to-month, 12 |
| `malva-wireless-5g-plus` | home-wireless-internet | Air 5G Plus | fixed-wireless, 5g, 500 Mbps, unlimited, $75 | month-to-month, 12 |
| `malva-phone-essential` | phone-plans | Essential 5GB | 5 GB, 5G, $25 | month-to-month, 12 |
| `malva-phone-plus` | phone-plans | Plus 20GB | 20 GB, 5G, 10 GB hotspot, $35 | month-to-month, 12, 24 |
| `malva-phone-unlimited` | phone-plans | Unlimited | unlimited, 5G, 30 GB hotspot, badge most-popular, 1 add-on included, $50 | month-to-month, 12, 24 |
| `malva-phone-unlimited-max` | phone-plans | Unlimited Max | unlimited, premium 5G, unlimited hotspot, 2 add-ons included, $65 | month-to-month, 12, 24 |
| `malva-spotify` | streaming-entertainment | Spotify | applies to internet and phone, tag Music, $10 | monthly |
| `malva-appletv` | streaming-entertainment | Apple TV+ | applies to internet only, tag Video, $10 | monthly |
| `malva-secure` | security-and-protection | Malva Secure | applies to internet only | monthly |
| `malva-device-protect` | security-and-protection | Device Care | applies to phone only, tag Extras, $12 | monthly |
| `malva-applemusic` | streaming-entertainment | Apple Music | applies to internet and phone, tag Music, $11 | monthly |
| `malva-netflix` | streaming-entertainment | Netflix | applies to internet only, tag Video, $8 | monthly |
| `malva-disneyplus` | streaming-entertainment | Disney+ | applies to internet only, tag Video, $8 | monthly |
| `malva-cloud-200` | security-and-protection | Cloud 200GB | applies to internet and phone, tag Extras, $3 | monthly |
| `malva-router-ac1200` | routers-and-equipment | Malva WiFi 5 Router AC1200 | max 300 Mbps, cable and fixed-wireless | rental, purchase |
| `malva-router-ax3000` | routers-and-equipment | Malva WiFi 6 Router AX3000 | max 1000 Mbps, cable and fixed-wireless | rental, purchase |
| `malva-mesh-be9300` | routers-and-equipment | Malva WiFi 7 Mesh BE9300 | max 2500 Mbps, cable and fixed-wireless | rental, purchase |
| `malva-modem-docsis31` | routers-and-equipment | Malva DOCSIS 3.1 Modem | max 2000 Mbps, cable only | rental, purchase |
| `malva-5g-gateway` | routers-and-equipment | Malva 5G Home Gateway | max 500 Mbps, fixed-wireless only | rental |

Plan and add-on names, prices and tags follow the design prototype (`design/DESIGN.md` "Prototype data") so the storefront matches the designs; they remain demonstration values defined in the manifests, and the table fixes only which cases must exist. Equipment rows are not in the design; they exist for the compatibility cases. Third-party names (Spotify, Apple TV+) are used as demonstration content and do not imply any commercial arrangement.

Handset and offer rows (names are demonstration values):

| Key | Category | Name | Notable attributes | Variants |
| --- | --- | --- | --- | --- |
| `malva-phone-nova-5g` | phones-and-devices | Nova 5G | 5g | colors black, silver; 128 / 256 GB |
| `malva-phone-nova-pro` | phones-and-devices | Nova Pro | 5g | colors black, silver, violet; 256 / 512 GB |
| `malva-offer-<product key suffix>` | by wrapped product | one `malva-offer` per row above (plans, add-ons, equipment, handsets) | `offer-kind`, `anchors`, audience `consumer` | one per offer |
| `malva-offer-cable-existing-customer` | cable-internet | Cable 500, existing customers | `existing-customer: existing`, anchors `malva-cable-500` | one |
| `malva-offer-phone-online-only` | phone-plans | Unlimited, online only | channels `online`, anchors `malva-phone-unlimited` | one |

## Components

| Component | Notes |
| --- | --- |
| Product manifests | One per product, naming product type, category keys, tax category, attributes, variants, prices |
| Price manifests | USD embedded prices per variant; term discounts expressed in the data, not computed |
| Inventory manifests | Entries for physical equipment only; services carry none |
| Product publication | Every seeded product is published, because the storefront reads current projections |
| Search readiness | Seeding waits for or reports the search index lag before declaring the catalog usable |

## commercetools

**Entities:** `Product`, `ProductVariant`, `Price`, `InventoryEntry`, `ProductType`, `Category`, `TaxCategory`

**Verified API surface**

- (concept) Only published products have a current projection, and a newly created product has only a staged one, so an unpublished seed is invisible to the storefront — [docs](https://docs.commercetools.com/api/product-catalog-overview)
- (rest) Product Search reflects changes asynchronously, and availability is derived from inventory with a further delay — [docs](https://docs.commercetools.com/learning-model-your-product-catalog/inventory-modeling/inventory-management)

**Constraints that change the design**

- Third-party offers are demonstration data; the seed must not be mistaken for a real product list or reused unreviewed in a production project.
- Embedded prices are used rather than standalone prices because price facets and sorting on listing cards depend on them.

**Modeling notes**

The case table, not the product list, is the contract: a future edit may rename or reprice anything as long as each scenario above still has a case. A test that loads the manifests and asserts every scenario is cheap and keeps the demonstration set honest.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-platform`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Do services need an InventoryEntry at all for cart and order flows to accept them, or is the absence of an entry enough? This should be checked against the platform before the seeder decides.
- Decided: a plan card's headline price and validity line come from the product's master variant. Seed manifests therefore make the master variant the term the design shows (cable 24-month, wireless 12-month, phone month-to-month); other terms are further variants.
- Decided: the cable speed chips are bands on downstream speed: "Up to 500 Mbps" is `<= 500` (Cable 100 and Cable 500) and "1 Gbps" is `> 500` (Cable Gig).
- Are rental and purchase of equipment two variants of one product, or two products with different tax treatment?

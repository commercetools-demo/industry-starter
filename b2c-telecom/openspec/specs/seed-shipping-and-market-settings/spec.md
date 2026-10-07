<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Zero-cost shipping and the market settings checkout depends on

## Purpose

Checkout cannot complete without a shipping method that matches the buyer's address, a tax category on every product and a store that defines which products and languages the buyer sees. For Malva these are mostly formalities: SIM cards, routers and activation kits ship at no charge, and the add-ons ship nothing at all. Because they are formalities they get forgotten, and an empty project fails at the last step with a message that points nowhere. Seeding them alongside the catalog means a newly seeded project can take an order from the first listing to the confirmation page.

## Requirements

### Requirement: Zero-cost shipping and the market settings checkout depends on

The system SHALL seed the zone, tax category, shipping methods, store and product selection that let a cart for the seeded market be priced, given a shipping method and ordered, with shipping that costs nothing to the buyer.

#### Scenario: Shipping option is free
- **GIVEN** a cart with a shipping address in the seeded country
- **WHEN** the shipping methods for the cart are requested
- **THEN** at least one is returned, and its rate for the cart's currency is zero

#### Scenario: Digital-only cart
- **GIVEN** a cart that holds only add-ons with no physical item
- **WHEN** checkout asks for a shipping method
- **THEN** the storefront either selects the zero-cost digital delivery method without asking the buyer or skips the step, and the order can still be placed

#### Scenario: Every product taxable
- **GIVEN** every seeded product
- **WHEN** its tax category is read
- **THEN** one is assigned, and the cart can be priced for an address in the seeded country

#### Scenario: Storefront sees only the intended assortment
- **GIVEN** the seeded store and product selection
- **WHEN** the storefront lists products through the store
- **THEN** it sees the seeded Malva offers and nothing else in the project

#### Scenario: Project settings missing
- **GIVEN** a project that lacks the seeded country, currency or language
- **WHEN** the seeding command runs
- **THEN** it stops before writing resources that depend on them, and names the missing setting and where it is changed, rather than silently altering project-wide settings

#### Scenario: Shipping rate changed later
- **GIVEN** a decision to charge for shipping on a specific item
- **WHEN** the manifest's rate is changed and reseeded
- **THEN** the shipping method is updated in place, with no storefront change

## Components

| Component | Notes |
| --- | --- |
| Zone `malva-zone-us` | Contains the seeded country; the first and only zone to start |
| Tax category `malva-telecom-services` | Placeholder rate for the seeded country, marked as such in the manifest |
| Shipping method `malva-shipping-standard` | Fixed rate of 0 in the seeded currency, in `malva-zone-us`, default method |
| Shipping method `malva-delivery-digital` | Fixed rate of 0, for carts without physical items |
| Store `malva-us` | Languages and countries of the seeded market; the storefront reads through it |
| Product selection `malva-all-offers` | All seeded products, attached to the store |
| Inventory entries | Equipment only; see `seed-catalog-data` |
| Settings check | Verifies project countries, currencies and languages, reports gaps, never edits them without an explicit flag |
| Market configuration | One `COUNTRY_CONFIG` entry in `site/` matching the seeded market, so both sides agree |

## commercetools

**Entities:** `Zone`, `ShippingMethod`, `TaxCategory`, `Store`, `ProductSelection`, `Project`

**Verified API surface**

- (concept) A Shipping Method belongs to one or more Zones, has a fixed or tiered rate per currency within each zone and is assigned a Tax Category; a Zone can appear once per Shipping Method — [docs](https://docs.commercetools.com/learning-model-your-product-catalog/shipping-methods/data-structure)
- (concept) Free shipping can be expressed as a free-above threshold on a fixed rate or as a Cart Discount targeting shipping cost, and the two should not be mixed — [docs](https://docs.commercetools.com/api/shipping-delivery-overview)
- (concept) A Tax Category is assigned to the product and to the Shipping Method, and the applicable rate is chosen from the shipping address — [docs](https://docs.commercetools.com/learning-model-your-business-structure/model-your-taxes/tax-categories-and-tax-rates)
- (concept) A Product Selection links a Store to its assortment — [docs](https://docs.commercetools.com/api/product-catalog-overview)

**Constraints that change the design**

- A zero fixed rate is chosen over a free-above threshold or a shipping Cart Discount. Free-above applies only to fixed rates and hides the original price on the cart; a shipping Cart Discount adds ranking and stacking concerns. Malva's shipping is always free, so the simplest mechanism that cannot be mis-ranked is a rate of zero.
- Zones, shipping methods, tax categories and stores are not covered by the Import API, so these are created through the HTTP API by the seeder.
- A shipping method soft limit of 100 per project is far above what this seed uses.
- Tax rate values are placeholders. Real telecom taxation varies by jurisdiction and service type and is not decided here.

**Modeling notes**

Keep the shipping rate in data, not in storefront code, even though it is zero. The storefront should render whatever the shipping-methods endpoint returns, including a zero price, rather than assuming "free" and hiding the line; that keeps the day a paid method is introduced a data change.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-storefront`, `commercetools-platform`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Which country, currency and language does the first market use? `US`, `USD` and `en-US` are assumed throughout.
- What tax treatment applies to telecom services, equipment and add-ons? A single placeholder category is seeded; real treatment may need separate categories for services and hardware.
- Should digital-only carts skip shipping entirely, or always attach the digital method?
- Is a pickup or store-collection method wanted later? It would be a third shipping method, not a change to these.

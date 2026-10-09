<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# One order covering several of the buyer's own sites

## Purpose

A buyer running plants, depots or branches places one purchase covering all of them, and forcing a separate checkout per site multiplies the work by the number of locations while losing the only view anyone wanted — what the whole thing costs. Once sites differ, price stops being a basket-level fact: each site resolves its own rate, its own territory and its own delivery point, so the site rather than the line becomes the unit the buyer reviews and the seller fulfills.

## Requirements

### Requirement: One order covering several of the buyer's own sites

The system SHALL let one order carry lines for several of the buyer's sites, each site holding its own configuration, resolved price and destination, and present a subtotal per site rolled up into one total the buyer confirms once.

#### Scenario: Several sites one order
- **GIVEN** a buyer configuring the same service for three of their sites
- **WHEN** they review the order
- **THEN** each site shows its own configuration, price and destination, with a subtotal per site and one combined total

#### Scenario: Sites priced independently
- **GIVEN** two sites whose agreement rates for the same item differ
- **WHEN** the order is priced
- **THEN** each site's lines carry that site's rate rather than one rate applied across the order

#### Scenario: Site added mid flow
- **GIVEN** an order already covering two sites
- **WHEN** the buyer adds a third site and configures it
- **THEN** the new site is priced and included, and the existing sites' prices and configurations are unchanged

#### Scenario: Tax follows each destination
- **GIVEN** two sites in different tax jurisdictions
- **WHEN** the order is priced
- **THEN** each site's lines carry the tax for that site's destination rather than one order-level rate

#### Scenario: One site fails validation
- **GIVEN** a site whose configuration is not available at its location
- **WHEN** the buyer attempts to confirm
- **THEN** that site is identified with the reason and the rest of the order is preserved, rather than the whole order being rejected

#### Scenario: Single confirmation
- **GIVEN** a confirmed order spanning several sites
- **WHEN** the confirmation is presented
- **THEN** one confirmation covers every site, its charges and its destination, and the buyer is asked to confirm once

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Sites added within one order | `[MIDDLEWARE]` | Existing sites chosen or new ones created in the flow |
| Configuration held per site | `[MIDDLEWARE]` | Identical across sites or entirely different, at the buyer's choice |
| Price resolved per site | `[MIDDLEWARE]` | Each site's agreement rate and territory, not one blended rate |
| Destination per site | `[MIDDLEWARE]` | Each site is its own delivery point |
| Subtotal per site and one rolled-up total | `[MIDDLEWARE]` | Both; a total without the breakdown cannot be approved |
| Tax resolved per destination | `[MIDDLEWARE]` | A site's tax follows where the goods or service land |
| One review and one confirmation | `[STATIC]` | Every site, charge and destination on one screen |

## commercetools

**Entities:** `Cart`, `LineItem`, `ShippingMethod`, `Zone`, `Order`, `Channel`, `Store`, `BusinessUnit`, `TaxCategory`

**Verified API surface**

- (concept) ShippingMode Multiple on the CartDraft is what allows individual items of one Order to use different Shipping Methods; the default Single mode cannot express a cart whose lines go to different destinations — [docs](https://docs.commercetools.com/api/shipping-delivery-overview)
- (update-action) The sequence is: put the destinations in the Cart's itemShippingAddresses, attach methods with Add ShippingMethod naming a shippingAddress, then assign them per line with Set LineItem ShippingDetails — [docs](https://docs.commercetools.com/api/shipping-delivery-overview)
- (concept) Carts and Orders can reference Business Units, so an order placed on behalf of a buying organization carries the organization whose sites its lines are for — [docs](https://docs.commercetools.com/api/projects/business-units)

**Constraints that change the design**

- Under ShippingMode Multiple a Line Item carries perMethodTaxRate and taxedPricePortions instead of a single taxRate, so code reading taxRate keeps working under Single mode and silently reads nothing once a cart spans destinations — [docs](https://docs.commercetools.com/api/shipping-delivery-overview)
- Setting a shipping address or method triggers recalculation of shipping cost, taxes and available options, so the storefront must re-read the cart after each change or show totals that no longer match — [docs](https://docs.commercetools.com/learning-implement-checkout/custom-checkout/shipping)
- Each buyer's negotiated Price is scoped by their distribution Channel, and the Carts API determines the Line Item price — so lines for sites on different Channels must be priced with each site's own scope rather than one cart-level price context — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/discover-and-order-products-in-b2b/product-search-for-b2b-catalogs)

**Modeling notes**

Create the cart in ShippingMode Multiple from the start. This is not a preference: under Multiple the tax moves into perMethodTaxRate and taxedPricePortions, and any code still reading the single taxRate field goes quietly empty rather than failing, which makes a late switch one of the most painful changes available. Each of the buyer's sites is an entry in itemShippingAddresses, and its lines are bound to it with Set LineItem ShippingDetails — the site, not the line, is what the buyer reviews, so group by shippingDetails when rendering. The harder problem is price: a cart carries one price context, and sites on different Distribution Channels have different negotiated rates, so per-site pricing means resolving each site's price outside the cart's own selection and setting it on the line. That is the point at which this capability and externally resolved pricing become one implementation rather than two. Every address or method change recalculates, so treat the cart as read-after-write throughout; a cached per-site subtotal across a destination change is the defect this model produces most.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-checkout`, `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- How many sites must one order support before the flow stops being usable, and what is the cap?
- When one site fails validation, may the rest be placed, or is the order all-or-nothing?
- Are new sites created during checkout provisional until the seller accepts them?

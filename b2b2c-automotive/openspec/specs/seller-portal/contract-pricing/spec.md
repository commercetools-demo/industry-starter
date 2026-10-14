<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Contract pricing shown as the cart will price it

## Purpose

A contract page is usually rendered from the contract record while the cart resolves its price through price selection over the buyer's channel-scoped prices. When the two sources drift, the buyer discovers it on the invoice and the seller argues about it, so the page has to read the same prices the cart will use, including the quantity break that applies at the quantity being shown.

## Requirements

### Requirement: Contract pricing shown as the cart will price it

The system SHALL present each active agreement with the prices the buyer's own orders resolve, so that the price shown for a covered SKU on the agreement and the price applied to a cart line for that same SKU cannot disagree.

#### Scenario: Contract price matches cart price
- **GIVEN** an active agreement covering a SKU with a quantity break
- **WHEN** the buyer adds that SKU to a cart at a quantity above the break
- **THEN** the unit price on the cart line equals the tier price shown for that quantity on the agreement

#### Scenario: Expiry warned before it bites
- **GIVEN** an agreement whose validity ends inside the configured warning window
- **WHEN** the buyer opens the agreement list
- **THEN** the agreement is flagged with its exact end date while its prices continue to apply until that date

#### Scenario: Expired agreement leaves no price
- **GIVEN** an agreement whose validity has ended and no successor agreement
- **WHEN** the buyer views a SKU that agreement covered
- **THEN** the SKU is presented as price on request rather than at the lapsed contract price, and adding it to a cart is refused

#### Scenario: Buyer has no agreement
- **GIVEN** a company with no negotiated agreement in force
- **WHEN** the buyer opens the page
- **THEN** the absence of an agreement is stated, with the route to request a quote rather than an empty table

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Active contracts list | `[MIDDLEWARE]` | Pricing / contract service |
| Contract detail — covered SKUs, discounts | `[MIDDLEWARE]` | Contract document |
| Expiry alerts | `[MIDDLEWARE]` | Evaluated against contract dates |
| Download contract PDF | `[MIDDLEWARE]` | Document service |

## commercetools

**Entities:** `StandalonePrice`, `Channel`, `Store`, `BusinessUnit`, `Product`, `ProductVariant`, `Cart`, `CustomerGroup`

**Verified API surface**

- (concept) A negotiated B2B price is carried by a distribution Channel (role ProductDistribution) attached to the buyer's Store and holding Channel-scoped Standalone Prices; the buyer never picks the scope - it derives from Business Unit to Store to Channel, passed as priceChannel for browsing and as the line item distributionChannel for carts
 — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-b2b-pricing/company-specific-pricing)

**Constraints that change the design**

- A quantity break is a PriceTier on the Price (minimumQuantity), not a discount, and applies to the whole line quantity once reached - but a tiered price is ignored when the Price is already discounted by a Product Discount
 — [docs](https://docs.commercetools.com/api/pricing-and-discounts-overview)
- Within each price-selection fallback step, time-bound prices take precedence over non-time-bound ones, and a price is returned only while the request timestamp falls inside its validFrom and validUntil window - so an agreement's expiry is silent: the price simply stops being selected
 — [docs](https://docs.commercetools.com/api/pricing-and-discounts-overview)
- When nothing matches the buyer's price context the ProductVariant comes back with no price field at all, and adding that SKU to a cart returns MatchingPriceNotFound; both are configuration signals to render as price on request, not platform errors
 — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-b2b-pricing/company-specific-pricing)
- A Customer-Group-scoped price outranks a Channel-scoped price in price selection, so using Customer Groups for anything other than discounts can silently override the negotiated rate for the same buyer
 — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-b2b-pricing/price-versus-discount)
- For B2B customer-group prices to apply to a cart, both businessUnit.customerGroupAssignments and cart.businessUnit have to be set; otherwise the platform selects the B2C price for that cart
 — [docs](https://docs.commercetools.com/api/pricing-and-discounts-overview)
- A ProductVariant supports up to 50000 Standalone Prices, so one bespoke price set per company does not scale - cluster buyers with comparable terms onto a shared pricing Channel and create a new Channel only for a genuinely new tier
 — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-b2b-pricing/company-specific-pricing)

**Modeling notes**

Treat the contract record as the commercial document and the Standalone Prices as its executable form, with one direction of derivation only; a page that renders the document while carts price from the platform is the drift this capability exists to prevent. Express validity as validFrom/validUntil on the prices so expiry is enforced by price selection rather than by storefront logic, and keep the expiry alert as a read over the same dates. Where an agreement is a percentage off list rather than a rate card, that is a discount concern and belongs on a Customer Group - do not model it as a second price on the same channel.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Is the contract service or commercetools the master for negotiated prices? Only one can be authoritative, and the other has to be derived.
- Are the discount levels on an agreement genuinely Cart or Product Discounts, or are they just how the negotiated rate is expressed against list price?
- Who is notified when an agreement lapses with no successor, and does the buyer keep browsing at list price or lose access to the assortment?

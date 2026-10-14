<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Viewing contract and account pricing

## Purpose

In B2B the list price is rarely the price. If negotiated pricing appears only on the product detail page, every listing, search result and saved list shows a number the buyer will not pay, which destroys trust in the catalog and makes basket totals unpredictable.

## Requirements

### Requirement: Viewing contract and account pricing

The storefront SHALL show a buyer the price their company has actually negotiated, on every surface where a price appears, rather than a list price the buyer will not be charged.

#### Scenario: Negotiated price everywhere
- **GIVEN** a buyer whose company has negotiated rates
- **WHEN** the buyer sees a price on any surface
- **THEN** it is the company's negotiated price, not the unscoped list price

#### Scenario: Volume tier applied
- **GIVEN** a product with tiered pricing for the buyer's company
- **WHEN** the buyer reaches a tier quantity
- **THEN** the tiered price is applied and the tier that produced it is visible

#### Scenario: No negotiated price exists
- **GIVEN** a product with no price scoped to the buyer's company
- **WHEN** the buyer views it
- **THEN** the fallback that applied is the one price selection resolves, and the buyer is not shown two conflicting prices

#### Scenario: Contract expired
- **GIVEN** a pricing contract past its validity period
- **WHEN** the buyer views a covered product
- **THEN** the expired rate is no longer applied and the buyer can see that the contract has lapsed

## Pages

- [Landing page with session-resolved buyer context](../home-landing-page/spec.md)
- [Product detail page showing the buyer's effective price](../product-detail-page/spec.md)
- [Category listing with request-derived filter and page state](../product-listing-page/spec.md)
- [Search results with exact part-number resolution](../search-results-page/spec.md)
- [Contract pricing shown as the cart will price it](../contract-pricing/spec.md)

## commercetools

**Entities:** `StandalonePrice`, `Price`, `Channel`, `CustomerGroup`, `Store`, `Product`, `Quote`

**Verified API surface**

- (concept) Company-specific rates are usually modeled as Channel-scoped Standalone Prices, with the buyer's distribution Channel carried on the cart's line items so each item resolves the negotiated rate — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/configure-b2b-pricing/company-specific-pricing)

**Constraints that change the design**

- Price selection resolves in a fixed precedence: currency, then validity dates, then customer group, then distribution channel, then country. Customer group takes precedence over channel, which takes precedence over country — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/price-calculation/price-selection)
- If valid Price tiers exist for the price matching the selection logic, the tiered price is used instead of the base price — tiers are part of selection, not a discount applied afterwards — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/price-calculation/price-selection)
- Price selection can resolve to no price found, which is how a product becomes unsellable for a given scope rather than merely unpriced — [docs](https://docs.commercetools.com/api/pricing-and-discounts-overview)
- Only Standalone Prices are available in the Modular ProductCatalogModel; Embedded Prices are Classic-only and cap at 100 prices per variant — [docs](https://docs.commercetools.com/api/pricing-and-discounts-overview)

**Modeling notes**

Keep price concerns and discount concerns separate: a negotiated rate belongs in price selection (Channel-scoped Standalone Price), a temporary promotion belongs in discounts. Mixing them makes contract renewals a discount-cleanup exercise. Because the catalog is cacheable and the price is not, plan the listing surfaces as cached catalog plus a per-buyer price overlay.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Is the contract record of truth commercetools, an ERP, or a CPQ system?
- Does the business need contract expiry alerts in the storefront, or only in the back office?

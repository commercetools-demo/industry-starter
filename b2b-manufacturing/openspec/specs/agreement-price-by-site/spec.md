<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# One agreement pricing each of the buyer's sites differently

## Purpose

A master agreement is signed once and then priced site by site, because the cost of serving a city depot and a remote plant under identical terms is not the same, and the same material can carry a different rate at each. Buyers under these agreements have negotiated those rates and read any other figure as an error or a breach. The requirement is therefore as much about what must not be shown as what must: a list price that leaks onto a covered buyer's page invites a dispute the seller cannot win, and a site override that fails to apply quietly bills the wrong rate for months.

## Requirements

### Requirement: One agreement pricing each of the buyer's sites differently

The system SHALL price a covered line from the rate the buyer's agreement sets for the site that line is for, and never present an uncovered list price as that buyer's price for a covered item.

#### Scenario: Site rate applies
- **GIVEN** an agreement setting different rates for the same item at two of the buyer's sites
- **WHEN** a line is added for each site
- **THEN** each line is priced at its own site's rate rather than at one organization-wide rate

#### Scenario: List price not shown to a covered buyer
- **GIVEN** a buyer whose agreement covers an item
- **WHEN** any surface prices that item for them
- **THEN** the agreement rate is presented and the uncovered list price is not shown as theirs

#### Scenario: Uncovered item falls back openly
- **GIVEN** an item the buyer's agreement does not cover
- **WHEN** the buyer views it
- **THEN** it is priced at the standard price and identified as outside the agreement, rather than appearing to be covered

#### Scenario: Agreement updated and prices follow
- **GIVEN** an agreement whose rates are amended with a new effective date
- **WHEN** the effective date passes
- **THEN** covered lines price at the new rates without any manual intervention on the storefront

#### Scenario: More than one entitlement
- **GIVEN** a buyer entitled through both a direct agreement and a buying group
- **WHEN** a covered line is priced
- **THEN** one payable rate is resolved by the stated precedence rule and the line records which entitlement applied

#### Scenario: Expired agreement
- **GIVEN** an agreement whose expiry date has passed
- **WHEN** a previously covered line is priced
- **THEN** the agreement rate is not applied and the buyer is told their cover has lapsed, rather than the rate continuing to resolve

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Agreements in force for the buying organization | `[MIDDLEWARE]` | With effective and expiry dates; more than one may be live |
| Rate per site within the agreement | `[MIDDLEWARE]` | The override level that matters most in practice |
| Rate per material or service within a site | `[MIDDLEWARE]` | Same service, different rate by what is handled |
| Buying-group affiliation as a pricing input | `[MIDDLEWARE]` | A buyer may be entitled through a body they belong to |
| List price withheld for covered items | `[MIDDLEWARE]` | Enforced where the price resolves, not in the template |
| Reference price shown beside the net where the agreement permits | `[CACHED]` | A reseller needs both to quote on; a covered end buyer usually needs one |
| Agreement identity recorded on the line | `[MIDDLEWARE]` | Which agreement and version priced it |

## commercetools

**Entities:** `StandalonePrice`, `Channel`, `Store`, `BusinessUnit`, `CustomerGroup`, `Cart`, `LineItem`, `Order`, `Type`

**Verified API surface**

- (concept) Business Units can be used to model company-specific products, pricing and discounts with the help of Stores, Product Selections and Channels — which is the mechanism by which an agreement's rates attach to a buying organization and its divisions — [docs](https://docs.commercetools.com/api/projects/business-units)
- (concept) Each buyer trades through a distribution Channel that carries their negotiated Price, and that Channel is the key prices are scoped by — so a site with its own rates is its own Channel rather than a variation inside one — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/discover-and-order-products-in-b2b/product-search-for-b2b-catalogs)
- (concept) Standalone Prices are separate resources associated to a Product Variant by sku, allow up to 50000 Prices per variant, are managed through their own API independently of Products, and can be staged with StagedStandalonePrice before publication — [docs](https://docs.commercetools.com/api/pricing-and-discounts-overview)

**Constraints that change the design**

- Price selection gives Customer Group precedence over Channel and Channel over country, and cascades down 17 priorities to a Price with no scope — so combining a buying-group Customer Group with a site Channel resolves by that fixed precedence and not by any rule of the seller's own — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/price-calculation/price-selection)
- Price selection checks Price validity dates as part of the cascade, so an expired agreement Price stops being selected and the next matching Price in the cascade answers instead — which is the standard price unless it is also scoped away — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/price-calculation/price-selection)
- Divisions inherit Stores — and therefore assortments and prices — from parent units unless the store mode is set explicitly, so a division intended to carry its own site rates will silently price from the company above it — [docs](https://docs.commercetools.com/api/projects/business-units)

**Modeling notes**

Model the buyer's site as a Division with its own Store and Distribution Channel, and set the store mode explicitly: inheritance from the Company is the default and is exactly how a site that was supposed to have its own rates ends up on the parent's. The hard constraint is that price selection's precedence is fixed — Customer Group beats Channel — so if buying-group entitlement is a Customer Group and site rates are Channels, a group-scoped price will win over a site-scoped one whatever the commercial intent. Where that inverts what the agreement says, the resolution has to move out of price selection into your own middleware, which then also owns the precedence rule and must record it on the line. Withholding the list price is not a presentation concern: a covered buyer's client must not be able to read the unscoped Price at all, which means Standalone Prices scoped per Channel and a projecting middleware rather than a storefront reading prices directly. Use StagedStandalonePrice for rate amendments so a new schedule can be loaded and published on its effective date instead of edited in place.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-platform`, `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- When a buyer is entitled through both a direct agreement and a buying group, which prevails, and who owns that rule?
- Which system is the record of truth for agreement rates, and how does an amendment reach the storefront?
- May a covered buyer ever be shown the list price, for example to evidence their saving?

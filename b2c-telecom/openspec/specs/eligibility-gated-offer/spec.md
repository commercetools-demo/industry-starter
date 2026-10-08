<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Offers resolved from where the service reaches and who is asking

## Purpose

In most industries the catalog is what the merchant sells and eligibility is an exception. In connectivity it is the other way round: an offer exists only where the network reaches, only for the kind of customer it was built for, and often only in the channel it was funded for. A fiber tier is meaningless at an address it does not serve, and a rate built for public-sector buyers is not for everyone who finds the URL. So eligibility is not a filter applied late to a universal catalog — it is what makes the catalog true for the person looking at it. Applying it in some surfaces and not others is worse than not applying it at all, because the offer a customer found in search and cannot add is a support call, and the one they can add but cannot be given is a canceled order.

## Plan notes

**As built by workstream K (D-020, D-021, D-059).** Serviceability is a built-in deterministic table stub (ZIP codes, cached 5 min; G's Custom Object table exists but is not read). Customer type comes from the Customer Group. "Ineligible offer absent not refused" is implemented by filtering listings. The existing-customer cable offer is deduplicated behind Cable 500 and reachable only through `?offer=` (Q-017). No agent override (D-022). Business-unit entitlement is not built (D-005).

## Requirements

### Requirement: Offers resolved from where the service reaches and who is asking

The system SHALL resolve which offers a customer may buy from their service location, their customer type and the sales channel they are in, and exclude the offers they do not qualify for from browse, search, pricing and cart alike.

#### Scenario: Catalog reflects the location
- **GIVEN** a customer who has supplied a service location
- **WHEN** they browse or search
- **THEN** only offers that serve that location are returned, at the prices that apply there

#### Scenario: Ineligible offer absent not refused
- **GIVEN** an offer restricted to a customer type this customer is not
- **WHEN** they browse, search or follow a direct link to it
- **THEN** it is not purchasable in any of those surfaces, rather than being visible and refused at the cart

#### Scenario: Channel restricted offer
- **GIVEN** an offer made available only in one sales channel
- **WHEN** it is requested from a different channel
- **THEN** it does not resolve, and the channel restriction is the reason recorded

#### Scenario: Location changes mid session
- **GIVEN** a cart built for one service location
- **WHEN** the customer changes the location
- **THEN** the cart is re-resolved and any line that the new location cannot be served is reported before checkout

#### Scenario: Eligibility lost before checkout
- **GIVEN** a cart holding an offer the customer qualified for when they added it
- **WHEN** their eligibility no longer holds at checkout
- **THEN** the order is not placed on the ineligible offer, and the change is explained

#### Scenario: Location not served at all
- **GIVEN** a location the network does not serve
- **WHEN** the customer asks what is available
- **THEN** they are told the location is not served, rather than being shown an empty catalog

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Service location established before browsing | `[MIDDLEWARE]` | The address decides the catalog, so it is asked for early |
| Offers scoped to what serves that location | `[CACHED]` | Not shown then refused |
| Customer type as an eligibility input | `[MIDDLEWARE]` | Consumer, business, public sector, existing customer |
| Sales channel as an eligibility input | `[MIDDLEWARE]` | An offer funded for one channel is not available in another |
| One resolution applied to every surface | `[MIDDLEWARE]` | Browse, search, pricing and cart agree or the gate leaks |
| Eligibility restated at checkout | `[MIDDLEWARE]` | The context can change between adding and ordering |
| Unserviceable location answered directly | `[MIDDLEWARE]` | An empty catalog is not an answer to can you serve me |

## commercetools

**Entities:** `Store`, `ProductSelection`, `Channel`, `CustomerGroup`, `BusinessUnit`, `Product`, `ProductProjection`, `Cart`

**Verified API surface**

- (concept) Product Selections manage the availability of Product Variants for a given Store, allowing merchants to curate specific catalogs for different regions, brands or customer segments, so Customers only see relevant Products — [docs](https://docs.commercetools.com/learning-model-your-business-structure/stores-and-channels/store-scoped-resources-and-data-fencing)
- (concept) A Product Selection list is built with inclusion or exclusion criteria — inclusion makes all or selected Variants available to a Store, exclusion disallows them — and a Store can reference more than one Selection — [docs](https://docs.commercetools.com/learning-model-your-business-structure/stores-and-channels/store-scoped-resources-and-data-fencing)
- (concept) Product Projections represent the state of a Product as visible to customers, taking into account the Product's publication status, the Store context and various projection dimensions — [docs](https://docs.commercetools.com/api/projects/productProjections)

**Constraints that change the design**

- Store scoping and Product Selections are the granularity the platform offers, and that granularity is the Store: an eligibility rule finer than the set of Stores you are willing to operate — a per-address serviceability answer — has no native representation and must be resolved by the implementation before the catalog is queried — [docs](https://docs.commercetools.com/learning-model-your-business-structure/stores-and-channels/store-scoped-resources-and-data-fencing)
- Unpublishing a Product makes it inaccessible through the Product Projection endpoints by default and removes it from the Product Search index, which is a catalog-wide state and not a per-customer eligibility mechanism — [docs](https://docs.commercetools.com/api/projects/productProjections)

**Modeling notes**

Split eligibility into the part the platform can hold and the part it cannot, and be honest about which is which. Customer type and channel map onto Customer Groups, Stores and Channels and belong there. Serviceability does not: it is a per-address question answered by a network inventory system with its own latency, and there is no number of Stores that models it. The workable shape is to resolve serviceability once, up front, into a coarse scope the catalog can be queried with — a Store, or a Product Selection chosen for this session — and to treat the fine-grained answer as context carried on the cart and revalidated before the order. The failure this capability is really about is inconsistency between surfaces, and it comes from implementing the gate per surface: search filtered in the search service, browse filtered in the catalog, the cart not filtered at all. Resolve the eligible scope once per request context and make every surface read from that one resolution. Decide early how long a serviceability answer stays good for, because it is the field most likely to be cached past its usefulness, and a stale yes is the expensive direction.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-platform`, `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Which system answers serviceability for an address, and how long may its answer be cached?
- How coarse may the catalog scope be before the number of Stores becomes unmanageable?
- When eligibility is lost between adding to cart and checkout, is the line dropped, repriced or held for an agent?
- How is a customer's type established for someone who has not yet signed in?

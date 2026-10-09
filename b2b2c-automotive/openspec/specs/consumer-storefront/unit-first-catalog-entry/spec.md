<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# No catalog until the vehicle it is for has been established

## Purpose

In most storefronts the catalog is the front door and filtering is something the shopper does afterwards. Here it is inverted: a part number that does not fit is not a poor recommendation, it is a return, a failed workshop booking and, with safety-relevant components, a liability. So the vehicle has to be pinned down first, and everything shown afterwards has to be scoped by it — including the paths people use to get round a storefront, which is where this usually fails. A shopper who reaches a product by a search-engine link, a saved list or a part number typed into quick order has skipped the funnel that established the vehicle, and a catalog that only filters the browse path will happily sell them the wrong thing. The second half of the problem is the shoppers who cannot answer the question. A fleet buyer knows the identifier; a private owner standing in a car park often does not, and a gate that only accepts a seventeen-character code turns them away at the first step. Both routes have to arrive at the same established vehicle, because everything downstream depends on there being exactly one answer.

## Requirements

### Requirement: No catalog until the vehicle it is for has been established

The system SHALL establish which vehicle a shopper is buying for before offering any fitment-dependent catalog, and scope browse, search and cart alike to what fits that vehicle.

#### Scenario: Catalog gated until a vehicle is chosen
- **GIVEN** a shopper who has not established a vehicle
- **WHEN** they open a fitment-dependent category
- **THEN** they are asked to establish the vehicle before any parts are offered

#### Scenario: Identifier route
- **GIVEN** a shopper holding the vehicle's unique identifier
- **WHEN** they enter it
- **THEN** the vehicle is established and the catalog is scoped to what fits it

#### Scenario: Narrowing route reaches the same answer
- **GIVEN** a shopper who does not know the identifier
- **WHEN** they narrow down by the attributes they do know
- **THEN** the same vehicle is established, and the catalog is scoped identically

#### Scenario: Direct link is still scoped
- **GIVEN** an established vehicle and a direct link to a part that does not fit it
- **WHEN** the shopper follows the link
- **THEN** the part is not purchasable for that vehicle, and the mismatch is stated

#### Scenario: Quick order is still scoped
- **GIVEN** a part number typed straight into quick order
- **WHEN** it does not fit the established vehicle
- **THEN** it is refused on fitment rather than added

#### Scenario: Universal item not gated out
- **GIVEN** an item that fits any vehicle
- **WHEN** the catalog is scoped
- **THEN** it remains available

#### Scenario: Changing the vehicle rescopes the basket
- **GIVEN** a basket built for one vehicle
- **WHEN** the shopper switches to another
- **THEN** lines that no longer fit are reported before checkout

#### Scenario: Fitment checked again at order
- **GIVEN** a basket whose lines fitted when they were added
- **WHEN** the order is placed
- **THEN** fitment is confirmed against the vehicle on the order

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Vehicle established before the catalog opens | `[MIDDLEWARE]` | A precondition for entry, not a filter applied afterwards |
| Identification by unique identifier | `[MIDDLEWARE]` | The exact route, for shoppers who have the code |
| A narrowing path for shoppers without one | `[MIDDLEWARE]` | Make, model, year, engine — arriving at the same answer |
| Established vehicle held for the session | `[MIDDLEWARE]` | Asked once, remembered, and changeable on purpose |
| Scope applied to every path into the catalog | `[MIDDLEWARE]` | Browse, search, direct link, quick order and reorder |
| Universal items still reachable | `[CACHED]` | Things that fit anything must not be gated out |
| Fitment reconfirmed before the order | `[MIDDLEWARE]` | The vehicle in context can change after a line is added |

## commercetools

**Entities:** `Store`, `ProductSelection`, `ProductType`, `Product`, `ProductProjection`, `CustomObject`, `Cart`, `LineItem`, `Type`, `Extension`

**Verified API surface**

- (concept) Product Projections represent the state of a Product as visible to customers, taking into account publication status, the Store context and various projection dimensions, and Store-scoped projections are retrieved through their own endpoints — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/design-b2b-catalogs/product-tailoring-for-b2b)
- (concept) Custom Objects store arbitrary JSON grouped into containers used like namespaces, and can be read by container and key — which is how a shopper's established vehicles are held without inventing a resource — [docs](https://docs.commercetools.com/api/projects/custom-objects)

**Constraints that change the design**

- commercetools has no vehicle, VIN or as-built configuration resource: the record that says which parts belong to one identified unit lives in the system that built it, and what the catalog can hold is the resulting fitment attributes — [docs](https://docs.commercetools.com/api/projects/custom-objects)
- A maximum of 50 Product Attributes per Product and 50 Variant Attributes per Product Variant can be indexed for Product Search, which caps how much fitment can be expressed as searchable attributes before it has to be resolved outside the catalog — [docs](https://docs.commercetools.com/api/limits)
- Within a Product Search request up to 100 elements can be fetched, the maximum pagination offset is 10000, and at most 50 expressions can be included in a single request including compound expressions — so a fitment filter expressed as a long list of matching identifiers will not fit in a query — [docs](https://docs.commercetools.com/api/limits)
- An API Extension validates a Cart update by responding 400 with an errors array, which is the only place a fitment rule survives a part number submitted directly against the Cart API rather than through the storefront — [docs](https://docs.commercetools.com/guides/extensions)

**Modeling notes**

Split this into the gate and the lookup, and keep them apart. The lookup — turning one vehicle's identity into the set of parts recorded against it — belongs to the system that holds the as-built record, and trying to mirror that record into the catalog is how these projects lose a year. What belongs here is the gate: establish the vehicle, hold it, and make every path into the catalog read from it. Resolve the established vehicle once per session into a compact fitment context, and store the shopper's known vehicles as a Custom Object keyed to the customer rather than as a bespoke resource. For the scoping itself, prefer searchable fitment attributes on the product where the shape of the data allows it, because then the platform does the filtering; but check the shape early, since only fifty attributes per product are indexed and a search request takes at most fifty expressions, so a fitment rule that reduces to a long list of applicable identifiers will not fit in a query and has to be resolved to a candidate set before the catalog is asked anything. Whichever route you take, put the final check in an API Extension on cart update and order creation. Every other enforcement point can be bypassed by a part number posted straight at the Cart API, and in this industry the thing being bypassed is the reason the gate exists. Treat the universal item deliberately — the common bug is a gate implemented as a required filter, which disappears the oil and the wiper blades along with the wrong brake discs.

## commercetools skills

Load `commercetools-platform` before implementing this capability. Supporting: `commercetools-connect`, `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-platform]`.

## Open questions

- Which system owns the as-built record, and how quickly can it answer during a browse session?
- How is a vehicle established for a shopper who has neither the identifier nor confident attribute knowledge?
- Can a shopper browse without a vehicle at all, and what are they allowed to see if so?
- What happens to a saved list when the vehicle it was built for is no longer in the account?

---

_Excluded for B2B2C: More than one vehicle kept per account._

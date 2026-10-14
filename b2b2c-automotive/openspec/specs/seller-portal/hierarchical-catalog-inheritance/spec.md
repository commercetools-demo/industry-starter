<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# A catalog composed down a chain, each level adding and excluding

## Purpose

A vehicle brand does not run one shop. It runs a chain — the manufacturer's organization, a national sales company, the brand, a dealer group, the dealer — and each link holds real authority over what is on sale at the links beneath it. The national company withdraws a model its market cannot type-approve; the dealer adds local fitting kits nobody else stocks; the group standardizes on a subset for all its sites. None of these is an exception to a central catalog, which is why a two-level override model breaks down here: the question is not what one shop changes about the master list, it is who is allowed to change what, and the answer is different at every level. The direction of the constraint matters more than the mechanism. A level may always narrow, and may add what it is entitled to add, but must never be able to reinstate something its parent withdrew — that withdrawal is usually legal or safety-driven, and a catalog that lets a local site sell round it is a compliance incident rather than a merchandising bug.

## Requirements

### Requirement: A catalog composed down a chain, each level adding and excluding

The system SHALL compose the catalog a shopper sees by inheriting it down the chain of organizations that share authority over it, letting each level remove items from what it inherited and add items of its own, without any level being able to widen what its parent allowed.

#### Scenario: Local level sees the inherited set
- **GIVEN** a level that has made no changes of its own
- **WHEN** its catalog is resolved
- **THEN** it shows exactly what it inherited from the level above

#### Scenario: Level excludes from what it inherited
- **GIVEN** a level that withdraws an item
- **WHEN** its catalog is resolved
- **THEN** that item is absent for it and for every level beneath it

#### Scenario: Exclusion cannot be reinstated below
- **GIVEN** an item withdrawn by an upper level
- **WHEN** a lower level attempts to add it back
- **THEN** the attempt is refused and the upper level's withdrawal stands

#### Scenario: Local addition stays local
- **GIVEN** an item added by one dealer
- **WHEN** a sibling dealer's catalog is resolved
- **THEN** the item does not appear there

#### Scenario: Same record presented differently
- **GIVEN** one product carried by two levels with different naming
- **WHEN** each resolves its catalog
- **THEN** each sees its own presentation of the same underlying record

#### Scenario: Not yet priced model
- **GIVEN** a model published as configurable before its prices exist
- **WHEN** it is browsed
- **THEN** it is shown at its actual lifecycle state rather than at a price of zero

#### Scenario: Change upstream reaches every level
- **GIVEN** a withdrawal made at the top of the chain
- **WHEN** catalogs below are next resolved
- **THEN** they reflect it without each level having to act

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Authority chain resolved for the session | `[MIDDLEWARE]` | Which levels apply, in order, before anything is queried |
| Inherited set as the starting point at each level | `[CACHED]` | A level edits what it received, never the master list |
| Exclusions applied top-down and not reversible below | `[CACHED]` | A withdrawal upstream is final for everyone downstream |
| Local additions scoped to the level that added them | `[CACHED]` | Visible beneath that level, invisible beside it |
| Presentation varied per level without forking the record | `[CACHED]` | One product record, local naming and imagery |
| Lifecycle state governing what may be published | `[MIDDLEWARE]` | A model can be configurable months before it is priced |
| The effective catalog explainable at any level | `[MIDDLEWARE]` | Why an item is present or absent, and which level decided |

## commercetools

**Entities:** `Store`, `ProductSelection`, `ProductTailoring`, `BusinessUnit`, `Channel`, `Product`, `ProductProjection`, `Category`

**Verified API surface**

- (concept) A Product Selection specifies a subset of the catalog in one of two modes: Individual as an allowlist, and IndividualExclusion as a denylist when the buyer should see most of the catalog with only a few restricted lines removed — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/design-b2b-catalogs/company-specific-product-catalogs)
- (concept) A Store can reference more than one Product Selection, so buyers who share most of a catalog and differ at the edges are modeled as a shared Product Selection plus a buyer-specific one on each Store — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/design-b2b-catalogs/resource-clustering)
- (concept) Business Units can be organized hierarchically up to a maximum of 5 levels with the top level always being a Company, each unit carrying parentUnit and topLevelUnit references, and each top-level unit including up to 4000 Divisions — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/model-buyer-organizations/business-units-company-and-division)
- (concept) Product Tailoring belongs to a Product and Store combination and overrides selected presentation data for that Store only, falling back to the original Product values for fields that are not tailored, and is surfaced only through the Store-scoped Product Projection — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/design-b2b-catalogs/product-tailoring-for-b2b)

**Constraints that change the design**

- Product Selections attached to one Store compose as a flat set with no notion of a parent Selection: there is no inheritance between Selections and no precedence between them, so an ordered chain of add-and-remove steps has to be resolved into one effective set before the Store is configured — [docs](https://docs.commercetools.com/learning-model-your-business-structure/stores-and-channels/store-scoped-resources-and-data-fencing)
- Tailoring changes presentation, not availability: if a Product is not available in the Store through an active Product Selection, tailoring it changes nothing a buyer can see — [docs](https://docs.commercetools.com/learning-model-b2b-commerce/design-b2b-catalogs/product-tailoring-for-b2b)
- A maximum of 15000 Product Selections per Product and 15000 Stores per Product can be indexed for Product Search, which bounds any design that gives every node in a large dealer network its own Store and Selection — [docs](https://docs.commercetools.com/api/limits)

**Modeling notes**

The platform gives you a Store with a flat set of Product Selections. It does not give you inheritance, and this is the single most important thing to understand before designing anything here: there is no parent Selection, no precedence between Selections on a Store, and nothing that will stop a lower level re-adding what an upper level removed. The chain is yours to resolve. Keep the authored data as what each level actually decided — a list of additions and a list of withdrawals per node — and compile that chain into one effective Product Selection set per selling node, top-down, with withdrawals winning over any later addition. Compile it as a build step, not per request; the inputs change daily at most and the output is read constantly. A Store per selling node is the natural mapping and it scales further than people expect, but check the indexing ceiling before assuming it: Product Search indexes at most fifteen thousand Stores per Product, and a large network with several brands per node reaches that faster than the node count alone suggests. When it does not fit, group nodes that share an effective set behind one Store rather than inventing a second mechanism. Use Product Tailoring for local naming and imagery, and hold the two apart in your head: Selection decides whether an item is there at all, Tailoring decides only how it looks, and tailoring an item a Store cannot see achieves nothing. Keep the compiled result explainable — record which level contributed each decision — because the question that arrives from the business is never "what is in the catalog" but "why can this dealer not sell that".

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-platform`, `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- How many levels of authority are there in practice, and can the depth differ between markets?
- Which levels may add items of their own, as opposed to only withdrawing from what they inherited?
- How quickly must a change at the top of the chain reach a selling node, and what is acceptable staleness?
- When a level is added, removed or re-parented, what happens to the carts and saved lists beneath it?

<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Configurations decided by rules, not enumerated as variants

## Purpose

A vehicle is chosen along a dozen or more axes — body, engine, transmission, drive, grade, trim, colors, packages, single options, market-specific equipment — and the axes constrain each other. The resulting number of buildable combinations runs to millions per model, and that number is the whole problem: it is far too large to enumerate as catalog records, and yet almost every combination a shopper can express is not buildable, so the storefront cannot simply accept whatever they pick. Treating configuration as a very large catalog fails on both sides. It will not fit, and maintaining it is impossible because the rules change with every production update, at which point the enumeration is stale and nobody can tell which entries are wrong. The workable inversion is to hold the axes and the rules that relate them, and to answer the only questions that actually matter: is what the shopper has chosen so far buildable, what can they still choose, and what would they have to give up to choose the thing they just clicked. That last one is what separates a usable configurator from a frustrating one — a shopper who picks an incompatible option should be told what it conflicts with, not silently prevented.

## Requirements

### Requirement: Configurations decided by rules, not enumerated as variants

The system SHALL determine whether a chosen combination of options is buildable by evaluating compatibility rules at the moment of choosing, rather than by looking the combination up in an enumerated list of sellable variants.

#### Scenario: Buildable combination accepted
- **GIVEN** a shopper choosing options that are compatible
- **WHEN** each choice is made
- **THEN** the configuration remains valid and the remaining choices are narrowed accordingly

#### Scenario: Incompatible choice explains itself
- **GIVEN** a shopper choosing an option that conflicts with an earlier one
- **WHEN** they select it
- **THEN** the conflicting earlier choice is named and the shopper is offered the trade

#### Scenario: Forced companion option
- **GIVEN** an option that cannot be fitted without a prerequisite
- **WHEN** it is chosen
- **THEN** the prerequisite is added and the shopper is told it was added and what it costs

#### Scenario: Price follows the configuration
- **GIVEN** a partially complete configuration
- **WHEN** an option is added or removed
- **THEN** the price is recomputed from the base and the chosen options rather than from a variant lookup

#### Scenario: Configuration reopened unchanged
- **GIVEN** a saved configuration
- **WHEN** it is reopened or shared
- **THEN** it resolves to the same options and the same price, or the differences are stated

#### Scenario: Rules changed since it was saved
- **GIVEN** a saved configuration that is no longer buildable
- **WHEN** it is reopened
- **THEN** it is reported as no longer buildable, naming what changed, rather than silently repaired

#### Scenario: Complete configuration is orderable
- **GIVEN** a configuration satisfying every rule
- **WHEN** it is added to the cart
- **THEN** it is carried as one orderable item with its full specification recorded

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Configuration axes held as data, not as products | `[CACHED]` | Body, engine, grade, color, packages, single options |
| Compatibility rules evaluated as choices are made | `[MIDDLEWARE]` | Answered per selection, not looked up per combination |
| Remaining choices narrowed after each selection | `[MIDDLEWARE]` | What is still reachable from where the shopper is |
| Conflicts explained rather than silently blocked | `[MIDDLEWARE]` | Which earlier choice stands in the way, and the cost of changing it |
| Options that force other options included automatically | `[MIDDLEWARE]` | A package that requires a prerequisite states that it added it |
| Price resolved for the configuration, not for a variant | `[MIDDLEWARE]` | Base plus the contribution of each chosen option |
| The completed configuration identified and reproducible | `[MIDDLEWARE]` | Saved, shared, quoted and re-opened without drift |
| Rule changes reconciled against saved configurations | `[MIDDLEWARE]` | What was buildable last month may not be this month |

## commercetools

**Entities:** `Product`, `ProductVariant`, `ProductType`, `StandalonePrice`, `CustomLineItem`, `Cart`, `LineItem`, `CustomObject`, `Type`, `Extension`

**Verified API surface**

- (concept) Product Types define Attribute Definitions whose attributeConstraint can be Unique, CombinationUnique, SameForAll or None, which is how variance between variants of one Product is validated — [docs](https://docs.commercetools.com/learning-model-your-product-catalog/attribute-types-and-attribute-groups/attribute-types)
- (concept) Custom Line Items can be added to a Cart with their own money amount and price mode, which is how a configured item priced from a base plus option contributions is carried when no catalog variant represents it — [docs](https://docs.commercetools.com/api/carts-orders-overview)

**Constraints that change the design**

- A Product can only have 100 Product Variants in the classic catalog model, and having too many Product Variants can cause a resource to reach the JSON document size limit — so a model with millions of buildable combinations cannot be expressed as variants at all — [docs](https://docs.commercetools.com/learning-model-your-product-catalog/product-modeling/products)
- If a Project uses the Modular ProductCatalogModel a maximum of 10000 Variants can be created per Product, against 100 ProductVariants per Product for the Classic model — the modular model raises the ceiling by two orders of magnitude and still does not reach millions — [docs](https://docs.commercetools.com/api/limits)
- attributeConstraint validates attribute values across the variants of one Product; it does not express compatibility between different attributes, so commercetools has no rule engine for 'engine X excludes transmission Y' and that logic has to live outside the catalog — [docs](https://docs.commercetools.com/learning-model-your-product-catalog/attribute-types-and-attribute-groups/attribute-types)
- An API Extension can validate a Cart update and reject it with a 400 and an errors array, which is where a configuration that no longer satisfies the rules must be caught before it becomes an order — [docs](https://docs.commercetools.com/guides/extensions)

**Modeling notes**

Do not enumerate. The limits settle the argument rather than merely discouraging it: a hundred variants per product in the classic model, ten thousand in the modular one, against millions of buildable combinations. Model the model as a Product, each option as catalog data with its own price contribution, and keep the compatibility rules in a configuration service outside commercetools — either a dedicated configurator or the system that already owns the production rules, which is usually the honest answer because that system is where the rules change. commercetools is then the price and order side of the conversation, not the arbiter of buildability: attributeConstraint validates values across variants and says nothing about one attribute excluding another, so expecting the catalog to enforce compatibility is a category error that surfaces late. Carry the resolved configuration on the cart as a Custom Line Item with its computed price and the full specification in Custom Fields, and give every configuration a stable identifier so a saved or shared one can be reopened and compared. Reopening is where the interesting failure lives. Rules and prices both move, so a configuration saved a month ago may be unbuildable, buildable at a different price, or buildable only with a substitution — all three need to be reported rather than quietly fixed, and the one to refuse outright is silent repair, because the shopper will order what they think they saved. Revalidate in an API Extension at order creation for the same reason: the gap between configuring and ordering is measured in weeks here, not minutes.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-platform`, `commercetools-connect`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Which system owns the compatibility rules, and how quickly do production changes reach the storefront?
- How long is a saved configuration honoured for, and is its price held for that period?
- When a saved configuration becomes unbuildable, is a nearest buildable alternative offered, and by whom?
- Are market-specific options modeled as separate axes or as a filter over a global option set?

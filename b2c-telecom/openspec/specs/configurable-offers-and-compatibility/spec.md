<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Configurable offers with compatibility computed from catalog data

## Purpose

A Malva offer is something a buyer assembles: a plan tier, a contract term, extras such as Spotify or Apple TV, and equipment. Not every combination works. A Wi-Fi 5 router that tops out at 300 Mbps cannot deliver a gigabit cable plan, and a phone-only protection add-on means nothing on an internet plan. The existing specs for compatible add-ons and exclusive offers say that such combinations must be refused and when. This spec fixes how they are decided: from attributes in the catalog, by one shared piece of logic, shown to the buyer as they choose and enforced again where the cart is changed. If the rules lived as hand-kept lists per offer, every new router would be a data-entry task and every omission would be a plan that cannot be provisioned.

This capability implements the data and evaluation side of `offer-compatible-addons` and `mutually-exclusive-offers` for the Malva catalog.

## Plan notes

**As built by workstream J (D-022, D-024, D-025).** Rules are pure TypeScript shared by server and client (`lib/offers/`); no API Extension. `compatible-addons` and `compatible-equipment` are positive exceptions that skip family, technology and speed rules (Q-011); "Explicit exception overrides computed compatibility" is built that way. Included equipment satisfies required kinds, so live plans auto-add no equipment line today. Rule errors use the `OFFER_RULE_VIOLATION` 409 body.

## Requirements

### Requirement: Configurable offers with compatibility computed from catalog data

The system SHALL let a buyer configure an offer from a listing card by choosing a contract term, optional add-ons and equipment, and SHALL decide which choices are compatible from catalog attributes and declared exceptions using one shared evaluation.

#### Scenario: Equipment too slow for the plan
- **GIVEN** a cable tier with a downstream speed above a router's maximum supported speed
- **WHEN** the buyer views that router among the tier's equipment choices
- **THEN** it is shown as unavailable for this plan with the reason that it supports less than the plan delivers, and it cannot be selected

#### Scenario: Equipment unable to use the technology
- **GIVEN** a modem that supports cable only and a home wireless plan
- **WHEN** the equipment choices for the wireless plan are shown
- **THEN** the modem is unavailable with the reason that it does not work with that service

#### Scenario: Add-on for another plan family
- **GIVEN** an add-on that applies to phone plans only and an internet plan card
- **WHEN** the add-on choices for the internet plan are shown
- **THEN** the phone-only add-on is not offered on that card

#### Scenario: Included extra not sold again
- **GIVEN** a plan whose included add-ons contain Apple TV+
- **WHEN** the card shows the add-ons
- **THEN** Apple TV+ appears as included at no charge and cannot be added a second time

#### Scenario: Explicit exception overrides computed compatibility
- **GIVEN** a router whose attributes would allow a plan but which declares that plan in its incompatible set
- **WHEN** the choices are evaluated
- **THEN** the router is unavailable, naming the declared exception as the reason

#### Scenario: Conflicting home internet services
- **GIVEN** a cart holding a cable internet plan
- **WHEN** the buyer adds a home wireless plan that declares a conflict with it
- **THEN** the addition is refused, the two offers are named and the buyer is offered the choice to replace the existing one, regardless of which was added first

#### Scenario: Server re-checks what the card allowed
- **GIVEN** a request to add equipment or an add-on that the shared evaluation rejects
- **WHEN** it reaches the cart endpoint, however it was produced
- **THEN** the cart is not changed and the response carries the reason in a form the card can display

#### Scenario: Catalog edit changes behaviour
- **GIVEN** a router's maximum supported speed raised in commercetools
- **WHEN** the catalog cache window has elapsed
- **THEN** the router becomes available for the higher tiers with no code change

#### Scenario: Cart older than the rule
- **GIVEN** a cart built before a router's attributes were reduced
- **WHEN** checkout starts
- **THEN** the now-incompatible line is reported and must be resolved before the order is placed

## Rules

Evaluation is a pure function of the plan, the candidate and the cart contents, so that the card, the cart endpoint and the tests all call the same code.

| Rule | Decided from | Reason shown |
| --- | --- | --- |
| Speed | candidate `max-downstream-mbps` is at least the plan `downstream-mbps` | Supports less than the plan delivers |
| Technology | plan `technology` is in candidate `supported-technologies` or `applies-to-technologies` | Does not work with this service |
| Family | plan family is in candidate `applies-to-families` | Not available for this kind of plan |
| Already included | candidate key is in plan `included-addons` | Already included |
| Declared exception | plan or candidate key is in candidate `incompatible-with` | Declared incompatible |
| Exclusive offer | any cart offer key is in plan `conflicts-with`, or the reverse | Cannot be held with the other offer |
| Required equipment | plan `required-equipment-kinds` satisfied by a compatible selection | Needs a compatible modem or gateway |

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Offer, add-on and equipment definitions | `[CACHED]` | Attributes that feed the rules |
| Configurator on the listing card | `[CACHED]` | Evaluates against definitions in the browser from plain data passed by the server |
| Unavailable choices with reasons | `[CACHED]` | Disabled and explained, not hidden |
| Compatibility against the current cart | `[MIDDLEWARE]` | Exclusive-offer and cart-wide rules |
| Cart endpoint re-evaluation | `[MIDDLEWARE]` | Authoritative; the card is only a convenience |
| Add-on lines linked to their plan line | `[MIDDLEWARE]` | A parent key custom field and cascading removal, per the skill's bundles pattern |
| Pre-checkout revalidation | `[MIDDLEWARE]` | Catches rules changed after the cart was built |
| `lib/offers/` evaluation module | `[STATIC]` | No I/O; imported by server and client |

## commercetools

**Entities:** `ProductType`, `Product`, `ProductVariant`, `Cart`, `LineItem`, `Type` (custom type), `Extension`

**Verified API surface**

- (concept) A Product Type attribute holding a set of values that name other products is the documented way to declare a relationship between products — [docs](https://docs.commercetools.com/guides/product-bundles)
- (concept) An API Extension runs on cart create or update before the result is persisted and can fail the call with a defined error such as InvalidInput; it sits on the critical path of every write it is registered for — [docs](https://docs.commercetools.com/api/projects/api-extensions)
- (concept) The platform does not enforce cart-composition rules of its own; rejecting an invalid composition is the Extension's job — [docs](https://docs.commercetools.com/guides/extensions)
- (storefront skill) Child line items are linked to a parent line item by a custom field, and mutations cascade from parent to children in a single batched cart update to avoid version conflicts — `commercetools-storefront` bundles reference

**Constraints that change the design**

- The BFF cart endpoint is the enforcement point for this storefront, because it is the only way the browser changes the cart. An API Extension is the stronger guarantee, since it also covers any other client, but it adds latency to every cart write; whether Malva needs it is an open question, not an assumption.
- Compatibility that depends on what the customer already holds (an existing wireless service) needs the system of record for held services, which is not commercetools. This spec covers the cart-contents case only.
- Because compatibility is computed from attributes, a missing or mistyped attribute silently makes an item compatible with everything. Seed validation and a catalog lint must reject equipment without a maximum speed and plans without a downstream speed.
- Plan, add-on and equipment lines in one cart are separate line items; the cart's speed, technology and family facts come from the parent plan line, which must therefore always be identifiable.

**Modeling notes**

Prefer computed rules to lists, and keep lists for exceptions. A router added to the catalog with the right attributes is automatically compatible with the right tiers, which is the reason attributes such as maximum speed and supported technologies exist. Declared exceptions are the safety valve for the cases the attributes cannot express, and they win over computed results. Show unavailable choices rather than hiding them: a buyer who sees that the entry router cannot carry the gigabit tier learns what to choose, while a missing router looks like a bug.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Does Malva need an API Extension in addition to the BFF check, given other clients (agent tools, mobile) may exist later?
- Are some compatibility failures overridable by an agent, as the exclusive-offers spec asks, or are all absolute?
- Which system is authoritative for services a customer already holds, and is it read at add time?
- Is required equipment (a modem for cable) selected by the buyer, defaulted, or added automatically?

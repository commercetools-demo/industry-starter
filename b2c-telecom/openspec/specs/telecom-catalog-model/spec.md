<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Telecom catalog model: plans, add-ons and equipment as typed products

## Purpose

A telecom catalog is not one kind of product. An internet plan is described by speed and technology, a phone plan by data and lines, an add-on by the provider it resells, and a router by the speeds it can carry. If they share one loose type, the attributes that make compatibility decidable (a router's maximum speed, an add-on's eligible plan families) end up as free text in descriptions, and every rule has to be written as a hard-coded exception. Modelling each kind as its own product type with typed, searchable attributes lets compatibility, filtering and comparison be computed from data, and lets the same data be seeded, edited in the Merchant Center and read by the storefront without translation.

## Plan notes

**As built by workstream G (differences from the spec's attribute table).** Added: `end-time`, `offer-family`, `intro-free-months`, `price-steps`, `addon-tag`, `label-plan-id`, `bundle-discount-text`, `activation-fee` (also a one-time price on cable variants) and plan facts copied onto offers. `isRequired` is dropped on set attributes (the platform refuses it); empty sets are omitted. Extra recurrence policies `malva-device-installment-12/24/36` and `malva-device-lease-24` (D-060). Customer-group keys are `consumer`, `small-business`, `employee`, `existing-customer` (no `malva-` prefix, D-058). Price keys use `_`, not `.`. No Stores or Product Selections (D-058).

## Requirements

### Requirement: Telecom catalog model

The system SHALL define the Malva catalog as six product types (internet plan, phone plan, add-on, equipment, device, and the offer that wraps the sellable ones) in a category tree of the four buyer intents, with every attribute needed for display, filtering and compatibility held as a typed attribute rather than free text.

#### Scenario: Internet plan described by typed attributes
- **GIVEN** a cable or home wireless internet plan
- **WHEN** its product data is read
- **THEN** its technology, downstream speed, upstream speed and contract term are typed attribute values, and the speed is numeric so it can be compared and sorted

#### Scenario: Equipment declares what it can carry
- **GIVEN** a router
- **WHEN** its product data is read
- **THEN** it declares its maximum supported downstream speed and the technologies it works with as attributes, so that compatibility with a plan is computable without a hand-maintained list

#### Scenario: Add-on declares where it applies
- **GIVEN** an add-on such as a streaming subscription
- **WHEN** its product data is read
- **THEN** it declares the plan families it can attach to and whether it is billed monthly or once

#### Scenario: Card is one product, selectors are variants
- **GIVEN** an internet or phone plan tier
- **WHEN** it is modelled
- **THEN** the tier is one product and each contract term is a variant of it, so a listing card maps to one product

#### Scenario: Keys and SKUs are predictable
- **GIVEN** any resource in the model
- **WHEN** its identifier is inspected
- **THEN** every key is stable and prefixed `malva-`, every variant has a unique SKU of the form `MLV-<family>-<tier>-<term>`, and none of them depends on a system-generated id

#### Scenario: Sellable offer separate from the thing sold
- **GIVEN** a plan, add-on, equipment item or device
- **WHEN** it is sold to a particular audience, channel or launch date
- **THEN** an offer product references it and carries the audience, channel, start time and compatibility declarations, so changing who may buy it never edits the plan, add-on, equipment or device itself

#### Scenario: Handset is one product with its options as variants
- **GIVEN** a handset
- **WHEN** its product data is read
- **THEN** it is one product whose variants differ by color and memory only, and the way it is acquired (outright, installments, lease) is not a variant (see `device-acquisition-mode`)

#### Scenario: Plan carries the facts the storefront shows
- **GIVEN** an internet or phone plan
- **WHEN** its product data is read
- **THEN** it holds, as typed attributes, every fact the listing card, filter chips and Broadband Facts label need: typical download, upload and latency, data allowance, price-lock length, early-termination fee text and an optional "most popular" badge, so no figure on those surfaces is free text in a description (see `design/DESIGN.md`, `broadband-facts-label`)

#### Scenario: Design filters derive from attributes
- **GIVEN** the design's filter chips (phone: Unlimited / Data-capped; wireless: 5G / LTE; cable: Up to 500 Mbps / 1 Gbps)
- **WHEN** a chip is applied
- **THEN** it is computed from `data-gb`, `network-generation` and `downstream-mbps` respectively, and no chip depends on a separate hand-maintained tag

#### Scenario: Editable in the Merchant Center
- **GIVEN** an attribute such as a router's maximum speed
- **WHEN** a merchandiser changes it in commercetools
- **THEN** compatibility results change after the catalog cache window without a code change

## Product types

| Key | Used for | Attributes (kebab-case) |
| --- | --- | --- |
| `malva-internet-plan` | Cable internet, home wireless internet | `technology` (enum: `cable`, `fixed-wireless`), `downstream-mbps` (number), `upstream-mbps` (number), `contract-term` (enum, variant-level: `month-to-month`, `12-months`, `24-months`), `charge-type` (enum, variant-level), `network-generation` (enum: `4g`, `5g`; fixed wireless only), `typical-download-mbps` / `typical-upload-mbps` / `typical-latency-ms` (number; label), `data-gb` (number, `-1` unlimited), `price-lock-months` (number), `early-termination-fee` (localized text, may be a formula such as "$10 x months remaining"), `badge` (enum, optional: `most-popular`), `included-addons` (set of text, add-on keys), `conflicts-with` (set of text, offer keys), `required-equipment-kinds` (set of enum), `required-addon-kinds` (set of enum: `installation`, `equipment`), `highlights` (localized text set) |
| `malva-phone-plan` | Phone plans | `data-gb` (number, `-1` for unlimited), `lines-included` (number), `hotspot-gb` (number), `network-generation` (enum: `4g`, `5g`), `typical-download-mbps` / `typical-upload-mbps` / `typical-latency-ms`, `early-termination-fee`, `badge`, `contract-term`, `charge-type`, `included-addons`, `conflicts-with`, `highlights` |
| `malva-addon` | Spotify, Apple TV, security, protection | `addon-kind` (enum: `streaming`, `security`, `protection`), `provider` (text), `applies-to-families` (set of enum: `internet`, `phone`), `applies-to-technologies` (set of enum, optional), `charge-type`, `trial-days` (number, optional), `highlights` |
| `malva-equipment` | Routers, modems, extenders, gateways | `equipment-kind` (enum: `router`, `modem`, `extender`, `gateway`), `max-downstream-mbps` (number), `supported-technologies` (set of enum), `wifi-standard` (enum), `charge-type` (enum: `monthly-rental`, `one-time`), `incompatible-with` (set of text, offer or SKU keys, for exceptions the attributes cannot express) |

| `malva-device` | Handsets | `brand` (text), `color` (text, variant), `memory-gb` (enum, variant), `os` (enum), `network-generation` (enum), `compatible-plan-families` (set of enum: `phone`), `highlights` |
| `malva-offer` | The sellable wrapper around one or more of the types above | `offer-kind` (enum: `base-package`, `addon`, `equipment`, `device`, `bundle`), `anchors` (set of text, product keys), `included-offers` (set of text, offer keys), `compatible-addons` / `compatible-equipment` (set of text, offer keys; exceptions only, computed rules win unless listed), `conflicts-with` (set of text, offer keys; evaluated symmetrically), `audience` (set of enum: `consumer`, `small-business`, `employee`), `existing-customer` (enum: `any`, `existing`, `new`), `channels` (set of text, channel keys), `start-time` (datetime) |

## Category tree

| Key | Slug (en-US) | Parent | Holds |
| --- | --- | --- | --- |
| `malva-cat-cable-internet` | `cable-internet` | none | Cable internet tiers |
| `malva-cat-home-wireless` | `home-wireless-internet` | none | Fixed wireless tiers |
| `malva-cat-phone-plans` | `phone-plans` | none | Phone plans |
| `malva-cat-add-ons` | `add-ons` | none | All add-ons and equipment |
| `malva-cat-devices` | `phones-and-devices` | none | Handsets |
| `malva-cat-streaming` | `streaming-entertainment` | add-ons | Spotify, Apple TV and similar |
| `malva-cat-equipment` | `routers-and-equipment` | add-ons | Routers, modems, extenders |
| `malva-cat-protection` | `security-and-protection` | add-ons | Security and device protection |

## Components

| Component | Notes |
| --- | --- |
| Product type definitions | Declarative, one file per type under `seed/data/product-types/` |
| Category definitions | Declarative, ordered with order hints; images attached as category assets |
| Attribute vocabulary | Enum keys are English and stable; labels are localized and may change freely |
| Offer-to-offer references by key | `included-addons`, `conflicts-with` and `incompatible-with` hold product keys so they survive re-seeding and cross-project copies |

## commercetools

**Entities:** `ProductType`, `Product`, `ProductVariant`, `Category`, `Price`

**Verified API surface**

- (concept) Product Types define the typed attributes (String, Number, Enum, LocalizedString and sets of them) that products carry, and enforce consistent formats — [docs](https://docs.commercetools.com/api/product-catalog-overview)
- (concept) A Product Type attribute holding a set of values that name other products is the documented way for one product to declare a relationship to others — [docs](https://docs.commercetools.com/guides/product-bundles)
- (rest) Product Variants carry unique SKUs, and uniqueness is enforced by the HTTP API rather than by the Import API — [docs](https://docs.commercetools.com/api/import-export/overview)

**Constraints that change the design**

- A Tax Category is assigned to the product, not the variant, so all contract terms of one tier share a tax treatment; a one-time hardware charge and a monthly service charge are different products or must share a category on purpose.
- Attribute type changes on an existing Product Type are not free: adding an attribute is routine, changing an attribute's type is not. The seeder reports this as a conflict instead of recreating the type; see `seeding-framework`.
- Product-level references to other offers by key mean a missing target is a silent gap; seed validation must check that every referenced key exists.

**Modeling notes**

Contract term is a variant attribute because it changes price. Choices that do not change price (installation appointment, delivery notes) are cart-line data, not variants, which keeps the variant count at tiers times terms rather than a combinatorial explosion. Money is stored once as an embedded price per variant; whether a charge repeats is the `charge-type` attribute, not a different price mechanism, until the recurring-prices question below is settled.

## Reference model (AT&T demo project)

The commercetools project `att-poc-61` (read through the `at_t` MCP server) is a worked telecom model: 8 product types, 9 categories, ~65 products, 15 cart discounts and 4 custom types. It is reference material, not a dependency. Full inventory and mapping: `plan/ATT-REFERENCE-MODEL.md`. What this model adopts, adapts and deliberately does not copy:

- **Adopted: "required add-on types" on a plan.** AT&T `service-base` carries `requiredAddonTypes` (installation, equipment, streaming-amount, ...) so checkout is blocked until one add-on of each type is chosen. Malva equivalent: `required-addon-kinds` (set of enum) on internet plans (equipment, installation) and the existing `required-equipment-kinds`; consumed by `configurable-offers-and-compatibility`.
- **Adopted: "unique in cart" on a service.** AT&T `uniqueInCart` stops two services of one type coexisting; Malva expresses the same through `conflicts-with` (see `mutually-exclusive-offers`); no extra attribute.
- **Adopted: charge type on the price.** AT&T keeps `chargeType` (ongoing / onetime) as a Custom Field on the Price (`custom-price` type), plus an optional additional charge. Malva keeps `charge-type` as a variant attribute (open question below); the AT&T pattern is the alternative if one variant needs both a monthly and a one-time amount.
- **Adopted (decided): separate sellable "offer" layer.** AT&T splits the *service* (`service-base`, `service-add-on`) from a sellable *offer* product (`offer`: `offerType` basePackage / addon / equipment / bundle, anchor `products`, `includedOffers`, `compatibleAddons`, `compatibleEquipment`, `conflictingOffers`, `eligibility`, `custType`, `existingCust`, `channels`, `startTime`). It exists because eligibility, audience and launch date vary independently of the service. Malva adopts it as `malva-offer`, but keeps technical and compatibility *facts* (speeds, supported technologies, applicable families) on the plan, add-on and equipment types so computed compatibility still works; the offer holds audience, channel, start time, inclusion, conflict and exception lists (see `eligibility-gated-offer`, `coordinated-offer-release`). Prices live on the offer's product, one price per variant, so a plan sold under two offers is two offer products, not two price lists on the plan.
- **Not copied: references by product id.** AT&T relation attributes are references to products and its cart discount predicates hard-code product ids; this breaks on re-seeding. Malva uses keys (see Components).
- **Not copied: payment mode as variants.** AT&T's `mobilephone` encodes outright / 12 / 24 / 36-month payment and the service plan as variant attributes (6 variants per color and memory: `sg23+b-256-12M-UL`). `device-acquisition-mode` requires one product and SKU with the mode on the line; keep that.
- **Not copied: free-text everywhere.** AT&T carries per-channel disclosure strings and HTML in localized text attributes; Malva keeps display facts typed.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-platform`, `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Is a monthly charge best modelled as an ordinary price with a `charge-type` attribute, or as a recurring price with a recurrence policy? The latter fits `subscriptions-and-recurring-orders` but changes the cart and checkout design.
- Which languages beyond `en-US` must the seeded localized strings cover?
- Are phone plans sold per line with quantity, or as fixed multi-line bundles?
- Where does the price live when an offer wraps a plan: on the offer's variants (as drafted above) or on the underlying plan with the offer carrying only rules? Pick one before seeding; the storefront listing card reads one price per card.
- Handsets are in scope: confirm whether any handset also needs the AT&T-style per-channel price (call-center price below web price) and how that interacts with `eligibility-gated-offer`.
- Some AT&T plans have a one-time charge on a base plan (`Gotta Have It` carries `chargeType: onetime`); decide whether any Malva plan needs a one-time component beyond activation fees.

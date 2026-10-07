<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Add-ons an offer allows, and nothing else

## Purpose

A connectivity offer is never one thing. It is a base service plus the extras that may ride on it — premium content, extra lines, a router, protection — and the set of extras that may ride on it is a property of that particular offer, not of the catalog. Sold the other way round, as a flat list of extras a customer may add to anything, the cart will happily accept combinations the network cannot deliver, and the failure surfaces at provisioning: days after the sale, as an order that cannot be fulfilled and a customer who was already told yes. Compatibility is cheap to enforce at add time and expensive to discover afterwards.

## Requirements

### Requirement: Add-ons an offer allows, and nothing else

The system SHALL permit only the add-ons and equipment an offer's own definition declares as compatible to be attached to that offer in a cart, rejecting any other with the reason it does not apply.

#### Scenario: Compatible add on accepted
- **GIVEN** an offer whose definition declares a set of compatible add-ons
- **WHEN** the customer attaches one of that set
- **THEN** it is added against that offer line and priced

#### Scenario: Incompatible add on refused
- **GIVEN** an add-on that is not in the offer's compatible set
- **WHEN** the customer attempts to attach it
- **THEN** it is refused and reported as not applicable to that offer rather than as a generic failure

#### Scenario: Included extra not charged again
- **GIVEN** an offer that already includes an extra at no additional charge
- **WHEN** the customer views the available add-ons
- **THEN** that extra is shown as already included rather than offered for sale a second time

#### Scenario: Add ons follow their parent
- **GIVEN** a cart holding an offer with add-ons attached to it
- **WHEN** the offer is removed
- **THEN** every add-on attached to it is removed with it, leaving no orphaned line

#### Scenario: Same add on different offer
- **GIVEN** an add-on compatible with one offer in the cart but not another
- **WHEN** the customer attaches it
- **THEN** it is attached to the offer that allows it, and its parent is unambiguous

#### Scenario: Compatibility changes after the cart was built
- **GIVEN** a cart built before the offer's compatible set was narrowed
- **WHEN** the cart is revalidated
- **THEN** the now-incompatible add-on is reported before checkout rather than passed to provisioning

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Compatible add-on set declared on the offer | `[CACHED]` | A property of the offer, not a global catalog list |
| Included extras distinguished from optional ones | `[CACHED]` | What the offer already carries, versus what may be added at a price |
| Add-on attached to its parent offer line | `[MIDDLEWARE]` | An add-on has no meaning standing alone in the cart |
| Incompatible add-on refused with a reason | `[MIDDLEWARE]` | Stated as not applicable to this offer, not as a generic error |
| Add-ons removed when their parent offer is | `[MIDDLEWARE]` | Nothing survives the offer it was attached to |
| Equipment offered per offer rather than per catalog | `[CACHED]` | Hardware is compatible with some services and not others |

## Design

Reference: `design/specs/addons.md`; tokens per `design-system-tokens`.

The Add-ons page: honey-tinted title strip, chips All / Music / Video / Extras, grid of add-on cards (`pink-900` 120px banner with the add-on name, tag, description, price per month, toggle CTA "Add to bundle" ⇄ "Added ✓"). A compact variant (initial tile, name, price) appears on the home page and in the bundle.

Design-to-spec mapping and deviations:

- The design lists every add-on for any plan ("Works with phone, wireless and cable") and **has no incompatibility, disabled or "needs a plan" state**. This spec requires one: unavailable add-ons must be shown disabled with the reason, and the design must be extended before build.
- Add-on identity is a text banner; partner logos are an open decision.
- Included add-ons ("1 add-on included" on Unlimited, "2 add-ons included" on Unlimited Max) are mentioned in plan bullets but have no designed selection UI.

## commercetools

**Entities:** `ProductType`, `Product`, `ProductVariant`, `Cart`, `LineItem`, `CustomObject`, `Type`

**Verified API surface**

- (concept) A bundle is modeled by a Product Type that references the Product Variants (SKUs) included in it, for example through a set of text Attributes naming the component SKUs — which is the same mechanism an offer uses to declare the add-ons compatible with it — [docs](https://docs.commercetools.com/guides/product-bundles)
- (concept) Where a component needs more than a SKU — a quantity, or in this case a flag for whether it is included or optional — a Custom Object represents that additional information and the component Attribute holds a reference to it — [docs](https://docs.commercetools.com/guides/product-bundles)
- (concept) AttributeNestedType lets a Product Type be defined once and referenced inside an Attribute Definition of another Product Type, composing structured data from reusable building blocks — [docs](https://docs.commercetools.com/learning-model-your-product-catalog/attribute-types-and-attribute-groups/nested-attribute-type)

**Constraints that change the design**

- AttributeNestedType is in public beta and carries documented caveats, so a compatibility model that depends on it is taking on a beta dependency rather than a settled one — [docs](https://docs.commercetools.com/learning-model-your-product-catalog/attribute-types-and-attribute-groups/nested-attribute-type)
- commercetools has no native bundle or add-on compatibility type: the component set is catalog data the implementation defines and the rule that a cart may only hold compatible combinations is enforced outside price selection, not by the platform — [docs](https://docs.commercetools.com/guides/product-bundles)

**Modeling notes**

Declare compatibility on the offer and read it at add time; do not infer it from categories. A category says what an add-on is, not which services it may attach to, and the moment two offers in the same category diverge — one allows the extra line, the newer one does not — a category-derived rule is wrong with no way to express the exception. The parent link matters as much as the rule: put a Custom Field on each add-on line naming the offer line it belongs to, because without it removal, repricing and provisioning all have to guess, and an add-on whose parent has gone is invisible rather than wrong. Enforce the rule on every cart write and again before checkout, not only on the add: compatibility is catalog data and catalog data changes underneath carts that are days old. Keep "included" and "optional" as distinct states on the component rather than modeling an included extra as an add-on priced at zero — the zero-priced reading loses the distinction the moment a discount or a price change touches it, and the customer is then offered something they already have.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- When an offer's compatible set is narrowed, what happens to carts and to already-provisioned services that hold the add-on?
- Can an add-on be attached to more than one offer in the same cart, or is it one per parent?
- Which system is authoritative for compatibility — the commerce catalog or the provisioning system that ultimately enforces it?

<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Offers that cannot be held at the same time

## Purpose

Connectivity products conflict in ways a general catalog has no vocabulary for: two plans on one line, a legacy tariff alongside its replacement, a promotional package that cannot be held with the loyalty rate the customer already has. None of these are stock problems and none are price problems, so nothing in an ordinary cart notices them. The conflict is real all the same, and where it is discovered decides what it costs. Caught in the cart it is a choice the customer makes for themselves. Caught after the order it is a provisioning failure, a retention call and, often, a refund — for a rule that was known before the customer ever clicked.

## Plan notes

**As built by workstream K (D-021, D-022).** All refusals are absolute (no agent override). "Conflict with a service already held" reads the customer's non-cancelled orders and recurring orders (D-021). Replacement is offered as a choice in the listing and the bundle ("Replace X with Y"). Cart-line conflicts reported by J and K are de-duplicated (`dedupeVerdict`).

## Requirements

### Requirement: Offers that cannot be held at the same time

The system SHALL prevent a cart from holding two offers declared mutually exclusive, naming the pair in conflict and the choice the customer has to make, rather than accepting both and failing after the order is placed.

#### Scenario: Second conflicting offer refused
- **GIVEN** a cart holding an offer declared to conflict with another
- **WHEN** the customer adds the conflicting offer
- **THEN** the cart is not allowed to hold both, and the two offers in conflict are named

#### Scenario: Replacement offered as a choice
- **GIVEN** a refused addition caused by an offer already in the cart
- **WHEN** the conflict is reported
- **THEN** the customer is offered the explicit choice of replacing the existing offer or keeping it

#### Scenario: Conflict with a service already held
- **GIVEN** a customer who already holds a service that conflicts with the offer being added
- **WHEN** the offer is added
- **THEN** the conflict is reported against the held service, not only against the cart's contents

#### Scenario: Non conflicting offers coexist
- **GIVEN** two offers with no declared conflict between them
- **WHEN** both are added
- **THEN** both are held and priced, and no warning is raised

#### Scenario: Conflict declared after the cart was built
- **GIVEN** a cart holding two offers that were compatible when they were added
- **WHEN** the cart is revalidated before checkout
- **THEN** the newly declared conflict is reported before the order is placed rather than after

#### Scenario: Conflict is symmetric
- **GIVEN** a conflict declared on one of the two offers only
- **WHEN** the offers are added in either order
- **THEN** the conflict is detected in both directions rather than depending on which was added first

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Conflicting offer set declared on the offer | `[CACHED]` | Which other offers this one cannot be held with |
| Conflict evaluated against the whole cart | `[MIDDLEWARE]` | Against every offer present, not only the one just added |
| Conflict evaluated against services already held | `[MIDDLEWARE]` | What the customer already has is part of the cart's context |
| The conflicting pair named | `[MIDDLEWARE]` | Which two offers, not that something is wrong |
| The choice offered explicitly | `[MIDDLEWARE]` | Replace the existing offer or abandon the new one |
| Conflict rechecked before checkout | `[MIDDLEWARE]` | A cart can be older than the rule that now governs it |

## commercetools

**Entities:** `ProductType`, `Product`, `Cart`, `LineItem`, `CustomObject`, `Extension`, `Type`

**Verified API surface**

- (concept) A Product Type Attribute holding a set of values naming other Product Variants, optionally via references to Custom Objects carrying extra detail, is the documented way one Product declares a relationship to others — the same mechanism available for declaring the offers an offer conflicts with — [docs](https://docs.commercetools.com/guides/product-bundles)
- (concept) An API Extension is called after the processing of a create or update request but before the result is persisted, and can validate the object and respond with a defined error code such as InvalidInput, which fails the API call — the point at which a conflicting combination is refused rather than recorded — [docs](https://docs.commercetools.com/api/projects/api-extensions)

**Constraints that change the design**

- Validating the composition of a Cart — the worked example is rejecting a Cart with more than ten Line Items — is documented as something an API Extension must do by returning 400 with InvalidInput, which is to say the platform does not enforce cart-composition rules of its own — [docs](https://docs.commercetools.com/guides/extensions)
- A Cart Predicate at Cart Discount level defines only whether that discount can apply: if the condition is met the discount applies, otherwise the Cart Discount is ignored for that Cart — so a predicate expresses no opinion about whether the Cart is permitted, and its failure mode is silence — [docs](https://docs.commercetools.com/learning-price-and-discount-your-products/discount-codes/discount-codes-and-cart-predicates)
- An API Extension affects the performance of the API it extends — if it fails or takes a second longer, the whole API call fails or takes a second longer — so a conflict check on every cart write is on the critical path of every cart write — [docs](https://docs.commercetools.com/api/projects/api-extensions)

**Modeling notes**

Declare the conflict on the offer and evaluate it symmetrically. Storing it on one side only is the defect this capability exists to prevent: whichever offer was authored second carries the reference, and adding them in the other order finds nothing. Resolve the declared set in both directions before deciding. The second trap is scope — the cart is not the whole picture. A customer who already holds the conflicting service has a conflict that no amount of cart inspection will find, so the evaluation needs the held-services context alongside the cart, and that context comes from the system of record rather than from commercetools. Do not reach for Cart Discount predicates: they are built to decide discounting and their failure mode is silence, which here means an accepted order. An API Extension refusing the update is the mechanism that actually says no — but price that choice honestly, because an Extension sits on the critical path of every cart write it is registered for and its latency is added to each one. If the held-services lookup is slow, cache it against the cart rather than calling the system of record on every line change. Recheck before checkout regardless, because conflicts are authored continuously and a cart can be older than the rule now governing it.

## commercetools skills

Load `commercetools-commerce-patterns` before implementing this capability. Supporting: `commercetools-storefront`. Any task generated from this spec carries `[SKILL: commercetools-commerce-patterns]`.

## Open questions

- Which system is authoritative for what the customer already holds, and how quickly can it be read during a cart update?
- Is a conflict ever overridable by an agent or an approval, or is it absolute?
- When a conflict is declared between an offer and its own replacement, what happens to customers mid-term on the old one?

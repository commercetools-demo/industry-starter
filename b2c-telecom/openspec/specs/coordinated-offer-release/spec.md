<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# A campaign's changes going live as one, or not at all

## Purpose

A connectivity campaign is never one edit. It is a new offer, the prices that go with it, the promotion that funds it, and the withdrawal of whatever it replaces — authored over days by several people and meant to appear at one moment. Released piecemeal, the intermediate states are all sellable: the new offer live at the old price, the promotion active with nothing to apply to, the replaced offer withdrawn before its successor appears. Each is a real order at a wrong price, honoured because the customer did nothing wrong. Campaigns also have launch times that marketing has already committed to externally, so "go live when the last edit is saved" is not a plan. Grouping the changes and releasing them together is what makes the launch an event rather than a window of inconsistency.

## Plan notes

**Seeder-applied release manifests, no approval UI (D-057, D-069).** A release is a manifest validated, previewed (CLI report) and applied all-or-nothing by the seeding framework, scheduled through offer `end-time` and price validity; rollback applies the previous manifest. Excluded: the approval UI and the scenario "Authoring and releasing are separate" (D-069: no approver list, second-person approval or operator identity gate); "Preview before approval" is built as a preview before apply. As built: the new offer can lag up to the 60 s catalog TTL after the release instant (X finding 1).

## Requirements

### Requirement: A campaign's changes going live as one, or not at all

The system SHALL release a group of related offer, price and promotion changes to customers as a single unit at a stated time, so that no part of a campaign is purchasable before the rest of it is.

#### Scenario: Nothing visible before the release
- **GIVEN** a campaign whose offers and prices have been authored but not released
- **WHEN** a customer browses
- **THEN** none of the campaign's elements are purchasable

#### Scenario: Everything visible after it
- **GIVEN** a release that has reached its stated time
- **WHEN** a customer browses
- **THEN** the offers, their prices and the promotion are all in effect together

#### Scenario: Preview before approval
- **GIVEN** a prepared release awaiting approval
- **WHEN** a reviewer previews it
- **THEN** they see the campaign as customers would see it, without it being live for anyone else

#### Scenario: Authoring and releasing are separate
- **GIVEN** a user who may author catalog changes but not release them
- **WHEN** they attempt to release
- **THEN** the release is refused and the change remains staged

#### Scenario: Replaced offer withdrawn in step
- **GIVEN** a campaign that replaces an existing offer
- **WHEN** the release takes effect
- **THEN** the replaced offer stops being purchasable at the same moment its successor becomes purchasable

#### Scenario: Release recorded
- **GIVEN** a release that has taken effect
- **WHEN** someone later asks what was in effect at a past moment
- **THEN** the record states what was released, when, and by whom

#### Scenario: Release withdrawn before its time
- **GIVEN** a scheduled release that is canceled before its stated time
- **WHEN** that time passes
- **THEN** nothing from it becomes purchasable

## Components

Data source tags: `[STATIC]` served from CDN with no middleware call; `[CACHED]` one shared middleware call at build or cache expiry; `[MIDDLEWARE]` called per request because the response is session-specific.

| Component | Data Source | Notes |
| --- | --- | --- |
| Changes grouped into a named release | `[MIDDLEWARE]` | Offers, prices, promotions and withdrawals together |
| Release previewed as customers will see it | `[MIDDLEWARE]` | Reviewed whole, before it is live |
| Approval before release | `[MIDDLEWARE]` | Authoring and releasing are different permissions |
| Release at a stated time | `[MIDDLEWARE]` | The launch time the business already committed to |
| Partial visibility prevented | `[MIDDLEWARE]` | No element purchasable ahead of the others |
| Withdrawal of what is replaced in the same release | `[MIDDLEWARE]` | The old offer goes as the new one arrives |
| Record of what was released and when | `[MIDDLEWARE]` | What a price was on a date, and who released it |

## commercetools

**Entities:** `Product`, `ProductProjection`, `ProductCatalogData`, `StandalonePrice`, `CartDiscount`, `ProductSelection`, `Store`

**Verified API surface**

- (concept) Product data exists as current and staged representations, and Product Projections can be retrieved restricted to either — which is the platform's mechanism for editing a product without those edits being visible to customers — [docs](https://docs.commercetools.com/api/projects/productProjections)
- (concept) Product Projections represent the state of a Product as visible to customers, taking into account the Product's publication status, the Store context and various projection dimensions — [docs](https://docs.commercetools.com/api/projects/productProjections)
- (concept) A Product Selection controls the availability of Product Variants for a given Store through inclusion or exclusion, which makes adding a prepared Selection to a Store a single switch that exposes many products at once — [docs](https://docs.commercetools.com/learning-model-your-business-structure/stores-and-channels/store-scoped-resources-and-data-fencing)

**Constraints that change the design**

- Unpublishing a Product only sets the published flag to false in ProductCatalogData and does not alter the data stored in the current or staged representations, so withdrawal and editing are independent operations — [docs](https://docs.commercetools.com/api/projects/productProjections)
- Staging is per Product and publish is a per-Product operation: there is no transactional release across many Products, nor any staged representation at all for Cart Discounts or Standalone Prices, so a campaign spanning offers, prices and promotions cannot be published atomically by the platform — [docs](https://docs.commercetools.com/api/projects/productProjections)

**Modeling notes**

The platform gives you staged-versus-current per Product and nothing broader, so the honest starting point is that there is no atomic multi-resource publish and the campaign has to be made to look atomic. Two approaches hold up. Prepare everything in a Product Selection that no Store references yet and release by attaching the Selection — one switch, many products, and the closest thing to a transaction available. Or publish ahead of time behind availability that is false until the launch moment, which works for prices and discounts too but means the data is live and a bug in the availability check is a leak. Prices and cart discounts are the awkward part either way: neither has a staged representation, so their validity dates are doing the work, and those dates are the thing to verify most carefully because a discount live an hour early is indistinguishable from a pricing error. Separate the permission to author from the permission to release — they are different risks and frequently different people — and keep the release record, because the question that will be asked is not what the price is but what it was at the moment a disputed order was placed, and reconstructing that from resource state after the fact is not possible.

## commercetools skills

Load `commercetools-platform` before implementing this capability. Supporting: `commercetools-connect`, `commercetools-commerce-patterns`. Any task generated from this spec carries `[SKILL: commercetools-platform]`.

## Open questions

- Is there a rollback for a release that has already taken effect, and what happens to orders placed under it?
- Who approves a release, and is there an expedited path for a correction that cannot wait?
- How far ahead may a release be scheduled, and what revalidates it if the catalog moves underneath it?
- Does the release boundary need to cover content and terms held outside commercetools as well?

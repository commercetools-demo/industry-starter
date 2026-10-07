<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Re-runnable, key-addressed seeding of a commercetools project

## Purpose

The storefront cannot be built or demonstrated against an empty commercetools project, and a hand-entered catalog cannot be reproduced for a second developer, a staging project or a demo reset. A seeding tool fixes that, but only if running it twice is as safe as running it once and it cannot be pointed at the wrong project by accident. Seed scripts that create blindly produce duplicates on the second run, stop half-way with no way to resume, and, worst of all, run happily against a production project because the credentials happened to be in the shell. The framework in this spec is what every seed capability (catalog, images, shipping and market settings) runs inside.

## Requirements

### Requirement: Re-runnable, key-addressed seeding

The system SHALL provide a seeding command in `seed/` that creates or updates every resource it owns by its stable key, so that running it repeatedly against the same project converges on the same state without duplicates.

#### Scenario: Second run changes nothing
- **GIVEN** a project already seeded from the current manifests
- **WHEN** the seeding command runs again
- **THEN** it reports every resource as unchanged and makes no write calls other than reads

#### Scenario: Manifest edited
- **GIVEN** a seeded project and a manifest in which a price or a name has changed
- **WHEN** the seeding command runs
- **THEN** only the affected resource is updated, and the report lists it as updated

#### Scenario: Interrupted run resumes
- **GIVEN** a run that failed part-way after creating some resources
- **WHEN** the command is run again
- **THEN** already-created resources are recognised by key, the remaining ones are created, and nothing is duplicated

#### Scenario: Dependencies respected
- **GIVEN** manifests in which products reference product types, categories and tax categories
- **WHEN** the command runs
- **THEN** it creates referenced resources before the resources that depend on them, in the order set out under Components

#### Scenario: Dangling reference caught before any write
- **GIVEN** a manifest that references a key that no manifest defines and the project does not hold
- **WHEN** the command is asked to plan or to run
- **THEN** it stops before writing anything and names the missing key and the resource that references it

### Requirement: Seeding that cannot hit the wrong project

The system SHALL require an explicit, matching confirmation of the target project and SHALL support a read-only plan mode, so that seeding can neither run against an unintended project nor surprise the person running it.

#### Scenario: Plan mode
- **GIVEN** any project and the manifests
- **WHEN** the plan command runs
- **THEN** it prints what would be created, updated and left unchanged, and makes no write calls

#### Scenario: Target not confirmed
- **GIVEN** credentials for a project whose key is not in the configured allow-list, or no confirmation flag naming the project key
- **WHEN** a write run is attempted
- **THEN** it refuses before any write and names the project key it found

#### Scenario: Reset limited to what was seeded
- **GIVEN** a project that holds seeded resources and resources created by hand
- **WHEN** the reset command runs and is confirmed
- **THEN** it removes only resources whose keys appear in the manifests and leaves everything else untouched

#### Scenario: Incompatible product type change
- **GIVEN** a manifest that changes the type of an attribute that already exists on a seeded product type
- **WHEN** the command runs
- **THEN** it reports the conflict and skips that product type and everything that depends on it, rather than deleting and recreating the type

#### Scenario: Credentials kept out of the repository
- **GIVEN** the seeding credential and the Pexels key
- **WHEN** the repository and the `site/` build are inspected
- **THEN** neither appears in either, and they are read only from the environment of the seeding process

## Components

| Component | Notes |
| --- | --- |
| `seed/` package | Own `package.json`; sibling of `site/`, never imported by it |
| Commands | `seed:plan`, `seed`, `seed:reset`, each taking `--confirm-project <key>` for writes |
| Manifests under `seed/data/` | Typed declarative data; the single source of truth for what is seeded |
| Dependency order | Project settings check, tax categories and zones, product types, categories, products and prices, inventory, shipping methods, stores and product selections |
| Run report | Created, updated, unchanged, skipped-with-reason, failed; non-zero exit on any failure |
| Seed validation | Pure checks run before any network call: referenced keys exist, SKUs unique, enum values valid |
| Seeding API client | Broad-scope client credentials, configured only in the seeding environment |

## commercetools

**Entities:** `ProductType`, `Category`, `Product`, `TaxCategory`, `Zone`, `ShippingMethod`, `Store`, `ProductSelection`, `InventoryEntry`

**Verified API surface**

- (rest) The Import API upserts by `key`, accepts up to 20 resources per request, resolves KeyReference values asynchronously, cannot delete resources and does not check SKU uniqueness — [docs](https://docs.commercetools.com/api/import-export/overview)
- (rest) The Import API supports product types, categories, products, prices, inventory, product selections and types, but not zones, shipping methods, tax categories or stores — [docs](https://docs.commercetools.com/api/import-export/overview)
- (rest) Import Requests are in public beta; Import Operations are kept for 48 hours — [docs](https://docs.commercetools.com/api/import-export/overview)

**Constraints that change the design**

- The seed set is small (tens of resources), the Import API cannot cover shipping and tax setup anyway, and it neither validates SKU uniqueness nor supports deletion, which the reset requirement needs. The seeder therefore uses the synchronous HTTP API through the TypeScript SDK with a get-by-key then create-or-update pattern. The Import API remains the right tool if the catalog grows to bulk volume, and is not ruled out for that case.
- Product type updates are expressed as update actions against a version, so the seeder computes a diff against the stored type; adding attributes is an action, changing an attribute's type is not.
- Concurrent or repeated category creation can be rejected by category tree locking, so categories are created sequentially, parents first.

**Modeling notes**

Treat the manifests as desired state and the project as observed state; the seeder is a reconciler, not a script. That framing is what makes the idempotence, plan and reset requirements fall out of one design rather than three. Keep the reconciler generic (key, fetch, diff, apply) and put the Malva specifics in data.

## commercetools skills

Load `commercetools-platform` before implementing this capability. Supporting: `commercetools-commerce-patterns`. Any task generated from this spec carries `[SKILL: commercetools-platform]`.

## Open questions

- Which projects belong in the allow-list: only a dev project, or dev and staging?
- Should seeded resources also carry a marker (a custom field or a key prefix check) beyond the manifest key list, to protect against a hand-made resource that happens to share a key?
- Does demo reset need to also clear carts, customers and orders created while demoing?

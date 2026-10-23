<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Platform project setup, cleanup and seed

## Purpose

The commercetools project holds Merchant Center sample data. Malva Coffee needs its own catalogue, prices, shipping, tax, stores, subscriptions and discounts, built by repeatable scripts so any developer can rebuild the project from nothing and the data is the same every time.

## Requirements

### Requirement: Project settings

The system SHALL, through a script, enable Product Search indexing (`changeProductSearchIndexingEnabled`, mode `ProductsSearch`, waiting until the status is `Activated`) and enable `changeCountryTaxRateFallbackEnabled` (set to true) in the project configuration. It SHALL also ensure the project's countries are US and CA, currencies USD and CAD, and languages en-US and en-CA, adding but never removing existing entries (D-030).

#### Scenario: Fresh project
- **GIVEN** indexing is deactivated and the fallback is off
- **WHEN** `npm run seed:settings` runs
- **THEN** both are enabled, the script waits for `Activated`, and a second run reports nothing to change

#### Scenario: Dry run
- **GIVEN** `--dry-run`
- **WHEN** the script runs
- **THEN** it prints the actions it would send and sends none

### Requirement: Safe cleanup of sample data

The system SHALL provide a two-step cleanup: an inventory step that reads the project and writes a reviewable manifest of every resource that is not seed-owned, and a delete step that removes only manifest entries, in dependency order (prices, products, discounts, shipping methods, tax categories, zones, categories deepest first, product types, recurrence policies, channels, custom types). The delete step requires `--confirm <projectKey>` and the manifest path, refuses a manifest older than 24 hours, and refuses anything with the seed prefix.

#### Scenario: Review before delete
- **GIVEN** the inventory step has run
- **WHEN** the manifest is opened
- **THEN** it lists resource type, key or id and name for each entry and a count per type

#### Scenario: Wrong confirmation
- **GIVEN** `--confirm` does not equal the configured project key
- **WHEN** the delete step runs
- **THEN** it aborts before any request

#### Scenario: Seed data protected
- **GIVEN** a manifest entry whose key starts with `mcf-`
- **WHEN** the delete step runs
- **THEN** that entry is refused and reported

### Requirement: Guards on every script

The system SHALL abort every seed script unless `SEED_CTP_PROJECT_KEY` equals the separately typed `EXPECTED_PROJECT_KEY` and the key the API reports, read credentials only from `seed/.env.local`, support `--dry-run`, and never print a secret.

#### Scenario: Mismatched key
- **GIVEN** `EXPECTED_PROJECT_KEY` differs from the API's project key
- **WHEN** any script starts
- **THEN** it aborts and prints both keys

### Requirement: Idempotent seed in dependency order

The system SHALL create or update, by key, in this order: tax categories and tax rates (US: food 0%, standard 8%, NY 8.875%; CA: food 0% zero-rated, standard 5% GST, no provincial tax modelled, D-036), zones and a standard-carrier shipping method with rates per currency (D-034), product types (pods, coffee, machine, accessory, gift set), categories, custom types (line item fulfilment, store, customer preferences, review), supply channels for the six New York City collection stores (invented NYC addresses and geo locations, D-035), recurrence policies, products with variants, standalone or embedded prices in USD and CAD, inventory per variant and per store channel, cart discounts and discount codes, demo customers with addresses, then reviews, published on creation with no review states (`reviews-and-ratings`, D-037). A second run SHALL report zero changes.

#### Scenario: Re-run
- **GIVEN** a seeded project
- **WHEN** `npm run seed` runs again
- **THEN** it reports `0 change(s)`

#### Scenario: Partial run
- **GIVEN** `--only products,prices`
- **WHEN** it runs
- **THEN** only those steps run and missing prerequisites are reported, not created silently

### Requirement: Seed ownership and keys

The system SHALL prefix every key the seed creates with `mcf-` (products, categories, channels, discounts, policies, customers, custom objects), except keys the application reads by fixed name, which are listed in one `CONTRACT_KEYS` constant. `reset` deletes only keys that match the prefix rule or `CONTRACT_KEYS`.

#### Scenario: Reset
- **GIVEN** a seeded project that also holds a hand-made product
- **WHEN** `npm run reset -- --confirm <key>` runs
- **THEN** the hand-made product remains

### Requirement: Images

The system SHALL take product, category and banner images from a JSON endpoint the owner provides (`IMAGE_SOURCE_URL`), shaped like `sample-data/image.json`: items under `pageProps.initialData.data[]` with `attributes.image.{small,medium,large,download_link}`, `attributes.width`, `attributes.height`, `attributes.description`. It SHALL store the clean URL (scheme, host and path only, no query, no fragment), preferring `download_link`, record the width and height, and write the result to a committed JSON file the seed reads. Without the file, products are seeded without images and a later `seed` run adds them to existing products.

#### Scenario: URL with query
- **GIVEN** an item whose `image.large` is `https://host/p/1.jpeg?auto=compress&w=1440`
- **WHEN** it is recorded
- **THEN** the stored URL is `https://host/p/1.jpeg`

#### Scenario: Blocked source
- **GIVEN** the endpoint answers HTTP 403
- **WHEN** the images script runs
- **THEN** it stops with a pointer to the owner action row and never tries to bypass the block

#### Scenario: Later images
- **GIVEN** products seeded without images
- **WHEN** the image file is added and `seed` runs
- **THEN** the existing products gain their images and nothing else changes

### Requirement: Verification

The system SHALL provide a `verify` script that reads back settings, counts and a sample of each resource type from the project, and exits non-zero on any mismatch with the seed definition, for use as evidence.

#### Scenario: Drift
- **GIVEN** a seeded product's price was edited by hand
- **WHEN** `npm run verify` runs
- **THEN** it reports that price and exits with a failure

### Requirement: Offline operation

The system SHALL run the whole seed against an in-memory fake API (`--offline`) so the plan and tests work without credentials.

#### Scenario: No credentials
- **GIVEN** no `.env.local`
- **WHEN** `npm run check` and `npm run seed -- --dry-run --offline` run
- **THEN** both pass and the second prints the full plan

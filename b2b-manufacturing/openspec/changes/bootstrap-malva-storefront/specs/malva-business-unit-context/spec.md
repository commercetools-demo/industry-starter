<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

## ADDED Requirements

### Requirement: Default public store and service selection

The system SHALL resolve one default commercetools Store (key from `CTP_DEFAULT_STORE_KEY`, expected `malva-web`) whose ProductSelection contains every published service, and SHALL scope all catalog reads to it.

#### Scenario: Anonymous browse
- **GIVEN** a visitor with no session
- **WHEN** a listing or detail page loads
- **THEN** catalog reads are scoped to the default store, and only services in its ProductSelection are returned

#### Scenario: Missing store
- **GIVEN** `CTP_DEFAULT_STORE_KEY` names a store that does not exist
- **WHEN** the server starts or first resolves it
- **THEN** it fails with a message naming the variable and the key, not an empty catalog

### Requirement: Store channel resolution

The system SHALL resolve a store's `storeId`, `supplyChannelId`, `distributionChannelId` and `productSelectionId` through one function `getStoreChannelData(storeKey)` in `lib/ct/stores.ts`, cached in the server instance, and every call site SHALL use it.

#### Scenario: One lookup per instance
- **GIVEN** many requests for the same store key
- **WHEN** they are served by one server instance
- **THEN** commercetools is asked for the store once

#### Scenario: Failure is not cached
- **GIVEN** the store lookup fails
- **WHEN** the next request arrives
- **THEN** the lookup is attempted again, and no partial data is written to a session

### Requirement: Atomic business-context session fields

The system SHALL write `businessUnitKey`, `storeKey`, `storeId`, `distributionChannelId`, `supplyChannelId` and `productSelectionId` together in one session update, and SHALL write the default-store fields (without `businessUnitKey`) for sessions that have no Business Unit.

#### Scenario: Anonymous session
- **GIVEN** a first-time visitor
- **WHEN** the first request that needs the session is handled
- **THEN** the session holds the default `storeKey` and its channel ids, and no `businessUnitKey`

#### Scenario: Signed-in client
- **GIVEN** a client who is an associate of one Business Unit
- **WHEN** they sign in
- **THEN** the same update writes the customer fields, `businessUnitKey`, and the store fields of that Business Unit's store (the default store if it has none)

#### Scenario: No partial state
- **GIVEN** the update fails halfway
- **WHEN** the response is returned
- **THEN** the session cookie is unchanged

### Requirement: Business Unit discovery at sign-in

The system SHALL, immediately after authentication, find the Business Units of which the customer is an associate through a project-level query, select the first, and use the as-associate chain for everything afterwards.

#### Scenario: Customer with no Business Unit
- **GIVEN** a customer who is not an associate of any Business Unit (for example a registration that has not completed)
- **WHEN** they sign in
- **THEN** sign-in succeeds, the session has no `businessUnitKey`, and business-unit-scoped endpoints answer 400 "No active business unit" while public pages keep working

#### Scenario: Several Business Units
- **GIVEN** a customer in two Business Units
- **WHEN** they sign in
- **THEN** the first is selected, the list is available through `GET /api/business-units`, and selecting another rewrites the business-context fields atomically

### Requirement: Business-unit-scoped client state

The system SHALL key every client-state entry that depends on the Business Unit by `[KEY, businessUnitKey]`, and SHALL clear the Business Unit entries on sign-out and on Business Unit change.

#### Scenario: Switch company
- **GIVEN** a user in two companies with lists loaded for the first
- **WHEN** they select the second
- **THEN** every list refetches for the second company and none of the first company's data remains visible

## commercetools

Skills: `commercetools-storefront` (`b2b/session-and-bu.md`, `b2b/customer-auth.md`), `commercetools-commerce-patterns` (Business Unit and store model). Resources: Store, ProductSelection, Channel (read), Business Unit (read). Creation of the Store, ProductSelection and Business Units is seeding and registration work, outside this change.

## MODIFIED Requirements

### Requirement: Store resolved from the path

The system SHALL treat the first path segment after the locale as the commercetools store key, resolve it in `proxy.ts` and `lib/ct/stores.ts` by reading the store (with its distribution channel, supply channel and product selection) through a short TTL cache, write `storeKey`, `distributionChannelId`, `supplyChannelId` and `productSelectionId` into the session together, and return the not-found page for an unknown store. The app SHALL NOT hold a tenant registry, custom-domain table or host mapping; domains and any host-to-path rewrite are set up manually at the hosting layer by an admin. The segment `categories` is reserved for the Malva listing pages and SHALL NOT be treated as a store key.

#### Scenario: Two resellers
- **GIVEN** stores `acme` and `bolt` created in the Merchant Center
- **WHEN** `/de-DE/acme` and `/de-DE/bolt` are opened
- **THEN** each shows its own assortment, prices, theme and published home page, and no data crosses

#### Scenario: Unknown store
- **GIVEN** `/de-DE/nope`
- **WHEN** it is requested
- **THEN** the response is 404 with no commercetools catalogue data

#### Scenario: No store segment
- **GIVEN** `/de-DE`
- **WHEN** it is requested
- **THEN** the Malva home page shows (see `design-malva-home`) and no store is resolved

#### Scenario: Malva listing is not a store
- **GIVEN** `/de-DE/categories/brakes`
- **WHEN** it is requested
- **THEN** the Malva listing renders and no store is resolved

#### Scenario: Store changes mid-session
- **GIVEN** a session written for store A
- **WHEN** the shopper opens store B's path
- **THEN** the four store fields update together and `cartId` is cleared

**Deviation:** the skill's proxy handles locale only. Path-based store resolution follows the `b2b2c-starter` customer app (`app/[locale]/[dealer]`).

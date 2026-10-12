<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Content pages (Contentools Puck pages and blocks)

## Purpose

Resellers build landing pages for their storefront (home, offers, about) with Contentools. All editing happens in Contentools' own Puck React components embedded in the portal, and the storefront renders the same documents with the Puck renderer. The portal does not build a page editor and offers no other CMS (the prototype's "Sanity" option is dropped).

Design source: `Malva Seller Portal.dc.html`, page `content` (list of pages with state, an edit panel with blocks). Contentools: `puck-page-manager`, `puck-content-manager`, `puck-editor`, `puck-renderer`, `puck-version-history`; service routes `puck-page`, `puck-content`, `page-version`, `page-state`.

## Requirements

### Requirement: Pages and content blocks use Contentools managers

The system SHALL mount `PageManager` for pages and `ContentManager` for reusable content items in the portal's Content page, through the portal's Contentools proxy (`projectKey`, `businessUnitKey` = session `storeKey`, absolute `baseURL`, placeholder `jwtToken`).

#### Scenario: List, create, edit, preview
- **GIVEN** a user with content permission
- **WHEN** the Content page opens
- **THEN** it shows the reseller's pages (list), and creating, deleting, editing in the Puck editor and previewing all happen inside Contentools' components

### Requirement: Draft, published and history come from Contentools

The system SHALL rely on Contentools' draft and published states and version history for pages and content items, and SHALL NOT add a second workflow.

#### Scenario: Publish
- **GIVEN** a draft page
- **WHEN** it is published in the editor
- **THEN** the storefront serves the published document at its slug after its cache lifetime

### Requirement: Storefront renders Puck documents

The system SHALL render Puck pages (home, landing and information pages) on the storefront with `PuckRenderer` or `PuckDataRenderer`, using the storefront's token adapter so blocks follow the reseller theme, and SHALL code the header, footer and commerce pages (listing, product, cart, checkout, account) in the application.

#### Scenario: Home page
- **GIVEN** a published page with slug for home
- **WHEN** a shopper opens the home page
- **THEN** the Puck content renders in the shell, and the vehicle finder block works as a Puck block (`consumer-storefront/design-vehicle-finder-and-garage`)

#### Scenario: No home page published
- **GIVEN** a reseller without a published home page
- **WHEN** the home page is requested
- **THEN** a default home layout (hero, finder, categories, popular products) renders

### Requirement: Commerce blocks available in the editor

The system SHALL register automotive blocks in the editor configuration: hero, vehicle finder, category tiles, popular products, promo banner, brand strip, so resellers compose home and landing pages from the designed components.

#### Scenario: Product carousel
- **GIVEN** a product carousel block for a category
- **WHEN** a product is withdrawn from the reseller's assortment
- **THEN** it disappears from the carousel at render

### Requirement: Mandatory elements are not content

The system SHALL render the fitment disclaimer, "sold and fulfilled by" and legal links from application code outside Puck content, so page edits cannot remove them.

#### Scenario: Page without them
- **GIVEN** a Puck page that contains none of these
- **WHEN** a product page renders
- **THEN** the application still shows them

### Requirement: Each reseller sees only its own content

The system SHALL scope pages and content by the store key, one store per reseller, and the proxy SHALL rewrite any other store key in a request to the session's store.

#### Scenario: Other reseller
- **GIVEN** a user of reseller A
- **WHEN** they open Content
- **THEN** only reseller A's pages appear

## Gaps

- The prototype stub (path, state, blocks list, "Open editor", "Publish") is replaced by the embedded components; the portal page chrome (header, tabs Pages / Content blocks / Media) needs design in the admin kit.
- Block library for automotive is not designed (hero, finder, tiles, product cards exist as storefront designs and must be wrapped as blocks).
- No localisation workflow in the prototype; Contentools has a `translations` configuration, confirm per-language page support.
- SEO fields exist as page `meta`; confirm what the editor exposes.

## Platform notes

Pages, states and versions are commercetools custom objects scoped per business unit in the Contentools service; media goes to its object store. Load `commercetools-storefront` (add-page) and `commercetools-connect` before building.

## ADDED Requirements

### Requirement: Home is a page-builder page
`/<locale>` SHALL render the page-builder page for path `/` when one is published. The authorable blocks SHALL include hero, category tiles, collection banner, product strip, editorial strip and subscribe strip, each a configurable component whose type key is in the published catalog.

#### Scenario: Published home
- **WHEN** a home page is published and the shopper opens `/en-US`
- **THEN** the page shows the authored components in the authored order, drawn by the storefront's own components

#### Scenario: Reordering
- **WHEN** an author moves the editorial strip above the product strip and publishes
- **THEN** the storefront shows that order without a storefront deploy

### Requirement: Configurable home components
Each home component SHALL expose only what an editor varies: text, rich text, image, link, and where relevant a data source (product list, category list) with item count. Product strips SHALL receive resolved product cards in the service's canonical shape and SHALL NOT fetch commercetools data themselves.

#### Scenario: Product strip bound to a data source
- **WHEN** an author binds a product strip to a product list data source with six items
- **THEN** the component renders six product cards with localized name, image and price for the shopper's market

#### Scenario: Missing optional field
- **WHEN** a hero has no secondary link
- **THEN** it renders without that link and without error

### Requirement: Native home fallback
While no home page is published, or on failure, the storefront SHALL render the existing native home (`content/home.ts`, `loadHomePage`). No page for path `/` SHALL NOT produce a not-found.

#### Scenario: Empty project
- **WHEN** the service answers `page_not_found` for `/`
- **THEN** the native home is shown, unchanged

#### Scenario: Service failure
- **WHEN** the render call fails
- **THEN** the native home is shown and the failure is logged

### Requirement: Home metadata
The home route SHALL keep its metadata, canonical and alternate-locale tags and JSON-LD regardless of whether the page is authored or native.

#### Scenario: Metadata on authored home
- **WHEN** the authored home renders
- **THEN** the title, description, `x-default` alternate and structured data are the same as on the native home

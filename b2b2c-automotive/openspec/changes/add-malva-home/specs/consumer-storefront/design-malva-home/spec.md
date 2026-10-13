## ADDED Requirements

### Requirement: Malva home page at the locale root

The system SHALL render the Malva home page at `/{locale}` (no store segment). It SHALL use Malva's default theme, not a reseller's, and SHALL NOT read or write a store, cart or account session. The page SHALL show, from top to bottom: the Malva header with category navigation, a banner carousel, the "Find your reseller" widget centred on the page, category tiles, and the footer.

#### Scenario: Opening the locale root
- **GIVEN** `/en-US` with no store segment
- **WHEN** it is requested
- **THEN** the Malva home page renders with status 200 and no store is resolved

#### Scenario: A store path is unaffected
- **GIVEN** `/en-US/mau-reseller-north`
- **WHEN** it is requested
- **THEN** the reseller's own home renders as before

### Requirement: Malva header with categories

The system SHALL show a header with the Malva wordmark, a category navigation of the first-level categories of the whole master catalog in order-hint order (a category is kept only when at least one product is in its subtree), a "Find your reseller" button that opens the finder drawer, and a locale switch. The header SHALL NOT show a cart, an account link or a store chip.

#### Scenario: Category navigation
- **GIVEN** the master catalog has first-level categories with products
- **WHEN** the header renders
- **THEN** each such category is a link to its Malva listing page and an empty category is absent

#### Scenario: No reseller controls
- **GIVEN** any Malva page
- **WHEN** the header renders
- **THEN** it shows no cart, no account link and no store chip

### Requirement: Banner carousel

The system SHALL show a carousel of at least three banners with a Pexels image, a headline and an optional link to a category listing, read from the Malva banner custom object written by the seed. It SHALL pause on hover and focus, offer previous, next and pause controls, and show the first banner when scripts have not run. A banner whose image URL is missing SHALL render with the theme background and its text.

#### Scenario: Banners present
- **GIVEN** three banners in the Malva banner object
- **WHEN** the home page renders
- **THEN** the carousel shows the first banner with controls for the other two

#### Scenario: Reduced motion
- **GIVEN** the shopper prefers reduced motion
- **WHEN** the home page renders
- **THEN** the carousel does not advance by itself

### Requirement: Finder in the middle of the page

The system SHALL place the reseller finder widget (see `design-reseller-finder`) in the vertical middle of the first screen, over or directly below the banner, and SHALL keep it usable without opening the drawer.

#### Scenario: First screen
- **GIVEN** a desktop viewport
- **WHEN** the home page renders
- **THEN** the finder with its search field and result list is visible without scrolling past the banner

### Requirement: Shop by category

The system SHALL show a tile per first-level category (image, name) linking to its Malva listing page.

#### Scenario: Category tile
- **GIVEN** the Brakes category tile
- **WHEN** it is chosen
- **THEN** `/{locale}/categories/{slug}` opens

### Requirement: Locale and not-found

The system SHALL offer both locales (en-US, de-DE) on every Malva string and SHALL make the not-found page's "home" link go to the Malva home of the current locale.

#### Scenario: Not-found link
- **GIVEN** the not-found page at `/de-DE/nope`
- **WHEN** "Back to home" is chosen
- **THEN** `/de-DE` (the Malva home) opens

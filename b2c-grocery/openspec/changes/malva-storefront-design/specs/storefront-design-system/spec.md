## ADDED Requirements

### Requirement: Token-driven visual language

The storefront SHALL take every color, font, spacing step, radius and shadow from the Organic design tokens and SHALL NOT hard-code a value a token carries. Ground `--color-bg` #f5ead8, surface #ebddc5, text #201e1d, accent #c67139, accent-2 #7a8a5e; headings Caprasimo, body Figtree 15px/1.55; spacing 4.4/8.8/13.2/17.6/26.4/35.2px; radii 8/16/28px; shadows sm/md/lg.

#### Scenario: Token used for color
- **WHEN** a component needs the accent color
- **THEN** it references `var(--color-accent)` or a ramp step, not a hex literal

#### Scenario: Accent as body text
- **WHEN** accent-colored text is paragraph-sized
- **THEN** it uses `--color-accent-700`, because the base accent is only 3:1 on the ground

### Requirement: Rounded, washed presentation

Containers SHALL use radius `--radius-lg` × 1.15 or larger, controls (buttons, inputs, tags, segmented) SHALL be pill-shaped, and content photography SHALL be wrapped in the washed treatment (saturate .6, contrast .85, brightness 1.1, opacity .94).

#### Scenario: Product photo
- **WHEN** a product or editorial image renders
- **THEN** it has rounded corners and the washed filter

### Requirement: Themed interaction states

Every interactive element SHALL have a themed hover tint, a pressed state one ramp step deeper, a 2px accent `:focus-visible` ring with 2px offset, and 45% opacity when disabled. Browser default focus rings SHALL NOT appear.

#### Scenario: Keyboard focus
- **WHEN** a user tabs to a button
- **THEN** a 2px accent outline with 2px offset is visible

#### Scenario: Disabled control
- **WHEN** a button is disabled
- **THEN** it renders at 45% opacity and does not respond to activation

### Requirement: Shared component set

The storefront SHALL provide Button (primary, secondary, ghost, icon, block), Tag (accent, accent-2, neutral, outline), Field/Input, Radio, Segmented control, Card (with kicker, title, meta), Product tile, Quantity stepper, Heart control, Section heading, Table, Dialog, Toast and Blob accent, built from the tokens.

#### Scenario: Product tile
- **WHEN** a product tile renders
- **THEN** it shows a washed image, name left and price right on one baseline, and the maker line below, and lifts 4px on hover

### Requirement: Site chrome

Every page SHALL render a sticky header (background at 92% with 10px blur) with wordmark, primary navigation (Shop, New in, Journal) with the active item in accent with a 2px underline, a search entry, a saved link, a bag button showing the count, and an account link; and a footer on the surface color with brand blurb and link columns. An announcement bar MAY render above the header.

#### Scenario: Bag count
- **WHEN** the session cart has items
- **THEN** the bag button reads "Bag · N", otherwise "Bag"

#### Scenario: Add-to-bag toast
- **WHEN** an item is added to the bag
- **THEN** a toast "Added to your bag" with a "View bag" button appears bottom-right and dismisses after 2.8 seconds

### Requirement: Layout and motion

Page content SHALL be at most 1360px wide with 35.2px side padding. Page entry SHALL animate with a 0.35s fade and 10px rise; tiles SHALL lift 4px on hover over 0.35s; users with reduced-motion preference SHALL NOT see these animations.

#### Scenario: Reduced motion
- **WHEN** the user prefers reduced motion
- **THEN** entry and hover-lift animations are disabled

### Requirement: Responsive behavior

At ≥1200px layouts SHALL match the desktop design. Between 768px and 1199px side rails collapse to sheets, grids reduce to two columns and heroes stack. Below 768px layouts SHALL be single column with compact navigation, collapsed search and sticky purchase bars. (Proposed; not drawn in the design.)

#### Scenario: Tablet filters
- **WHEN** the viewport is 1000px wide on a listing page
- **THEN** the filter rail is replaced by a "Filters" button that opens a sheet

### Requirement: Block-aligned page composition

Pages SHALL be composed in code from standalone section components named after the design's blocks — content (hero, sectionHeading, categoryShowcase, curatedProducts, editorial, promoBanner, newsletterSignup), listing (breadcrumbs, header, filters, resultCount, appliedFilters, sort, grid, pagination, empty), pdp (breadcrumbs, gallery, identity, price, description, options, addToBag, saveControl, availability, specs, related, reviews) and chrome (announcement, wordmark, primaryNav, search, accountLink, wishlistLink, bagIndicator, compactNav, footer parts) — each taking its authorable fields as props. A runtime block registry with authored-field validation is out of v1 (D-045).

#### Scenario: Hero as a component
- **WHEN** a page needs a hero
- **THEN** it renders a hero component with headline, body, image and button props

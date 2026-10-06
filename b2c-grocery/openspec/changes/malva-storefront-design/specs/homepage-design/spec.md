## ADDED Requirements

### Requirement: Homepage hero variants

The homepage SHALL render one of two hero variants selected by `homeLayout`. The editorial hero is a two-column grid (1.05fr/1fr) with an accent-2 tag, 76px headline, 18px body, a primary and a secondary button, a sage blob behind the copy, and a 560px washed image. The magazine grid is a 62px headline over a three-column grid with 230px rows where one tile spans 2×2, one spans two columns, and the rest are single.

#### Scenario: Editorial hero default
- **WHEN** no variant is set
- **THEN** the editorial hero renders

#### Scenario: Magazine grid
- **WHEN** `homeLayout` is "Magazine grid"
- **THEN** the grid renders and the editorial hero does not, and the sections below are unchanged

### Requirement: Category showcase

The homepage SHALL show a section heading with a "See all" ghost link and a six-column grid of cards, each with a 130px image, the category name and a two-digit piece count.

#### Scenario: Category click
- **WHEN** a visitor clicks a category card
- **THEN** the listing page opens filtered to that category

### Requirement: Curated products and editorial panel

The homepage SHALL show a four-column grid of product tiles with 340px images, followed by a full-width editorial panel on `accent-2-700` with kicker, 44px heading, body, inverted button and a 380px image.

#### Scenario: Product tile click
- **WHEN** a visitor clicks a curated tile
- **THEN** the product detail page opens

### Requirement: Concierge strip

The homepage SHALL show a bordered "Ask a stylist" strip with a blob icon, heading, copy and primary button when the concierge setting is on, and SHALL omit it without leaving a gap when off.

#### Scenario: Concierge off
- **WHEN** the setting is false
- **THEN** the strip is absent from the DOM

### Requirement: Session-specific elements stay out of shared content

The homepage SHALL resolve bag count and account identity per session, consistent with `home-landing-page`, and SHALL NOT embed them in cached shared markup.

#### Scenario: Anonymous visitor
- **WHEN** no session exists
- **THEN** shared merchandising renders and the account link points to sign-in

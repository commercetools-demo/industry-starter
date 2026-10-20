<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Home page

## Purpose

The home page states what Malva Coffee is (pods, coffee and machines, in the shop and at home), sends the shopper to a category in one click, and sells the collect-in-store promise.

Design source: `HomePage` in `pages-shop.jsx`.

## Requirements

### Requirement: Hero

The system SHALL open with a two-column hero on a canvas gradient: eyebrow (campaign or season), an 800-weight headline, a 18px supporting line, a primary "Shop the edit" button, a ghost "Find your store" button that opens the store picker, and a row of three promise items (shipping, collection, returns) with icons. The right column holds a rounded 4:4.4 hero image with a soft violet glow and a floating glass card naming a featured product with its price as a button.

#### Scenario: Hero product
- **GIVEN** a featured product is configured
- **WHEN** the hero renders
- **THEN** the glass card links to its detail page and shows its current price

#### Scenario: Narrow screen
- **GIVEN** a viewport under 900px
- **WHEN** the hero renders
- **THEN** the image column is hidden and the text column fills the width

### Requirement: Category tiles

The system SHALL show four 4:5 tiles in a grid, one per top category (Nespresso pods, Coffee beans, Machines, Accessories), each an image with a bottom gradient, label and arrow, linking to that category's listing.

#### Scenario: Tile order
- **GIVEN** merchandising reorders categories
- **WHEN** the home page renders
- **THEN** tiles follow the configured order, capped at four

### Requirement: Collection banner

The system SHALL show an ink rounded panel with a violet glow: eyebrow "Order online, collect in store", headline "Ready in {n} minutes at {store}", one line on live availability and reserving, buttons "Change store" and "Shop collect-eligible", and three small proof tiles (fast, reserved, no fees).

#### Scenario: Store named
- **GIVEN** the shopper has chosen a store
- **WHEN** the banner renders
- **THEN** the headline names that store; with none chosen it asks them to choose one

### Requirement: Bestsellers and new arrivals

The system SHALL show a "Bestsellers" and a "New arrivals" section, each as a four-up grid of product cards with an eyebrow, title and "View all" link; a section with no products is omitted.

#### Scenario: No new products
- **GIVEN** no product carries the New badge
- **WHEN** the page renders
- **THEN** the New arrivals section is absent

### Requirement: Editorial strip

The system SHALL show a two-column strip on the alternate canvas with an image and a brand-story block (eyebrow, headline, paragraph, button). For Malva this is the sourcing and roasting promise; for pods it is the capsule recycling promise.

#### Scenario: Editorial content
- **GIVEN** the strip is configured as content
- **WHEN** the page renders
- **THEN** copy, image and link come from the content source, not code

### Requirement: Subscribe and save strip

The system SHALL add a strip, not present in VELA, explaining coffee and pod subscriptions (choose, set an interval, skip or cancel any time) with a call to action to the subscribable range. New design needed (`design.md` section 6).

#### Scenario: Entry point
- **GIVEN** the strip is shown
- **WHEN** the button is pressed
- **THEN** the listing opens filtered to subscribable products

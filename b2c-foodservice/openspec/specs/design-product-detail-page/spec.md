<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Product detail page

## Purpose

The detail page turns interest into a committed line: the right variant, the right fulfilment (collect, ship, or subscribe) and a clear statement of when the shopper gets it. It must handle four product shapes with one layout: pods, coffee, machines and accessories.

Design source: `ProductDetail`, `Accordion`, `SizeGuide` in `pages-pdp.jsx`.

## Requirements

### Requirement: Layout

The system SHALL show breadcrumbs, then a two-column grid (gallery 1.05fr, buy box 0.95fr, 48px gap) collapsing to one column under 900px with thumbnails moving below the main image.

#### Scenario: Mobile
- **GIVEN** a 390px viewport
- **WHEN** the page renders
- **THEN** the gallery is first, the buy box second, and the add button is reachable without scrolling past the details

### Requirement: Gallery

The system SHALL show a column of 72x88 thumbnails and a large 5:6 image with the badge top left and the save heart top right. Selecting a colour or variant with its own imagery swaps the images. Pods and machines include a lifestyle shot and a pack shot.

#### Scenario: Variant imagery
- **GIVEN** a machine offered in three colours
- **WHEN** a colour is chosen
- **THEN** the gallery shows that colour's images

### Requirement: Buy box header

The system SHALL show category, product name (Archivo 700, 34px), price (22px, 600) with unit price, rating with count, and a one-line tagline.

#### Scenario: Price follows the variant
- **GIVEN** the shopper changes pack size
- **WHEN** the variant changes
- **THEN** price and unit price update immediately

### Requirement: Variant selectors per product shape

The system SHALL show only the selectors the product has, all as option buttons with disabled states:

| Shape | Selectors |
| --- | --- |
| Pods | Machine system (Original or Vertuo), pack (10 sleeve, 50 box, 100 box), plus an intensity bar and flavour notes as read-only facts |
| Coffee | Size (250 g, 1 kg), grind (whole bean, espresso, filter, French press, moka), roast shown as fact |
| Machines | Colour (swatches), bundle (machine only, with starter capsules, with milk frother) |
| Accessories | Colour or size where applicable; none for single-variant items |

The prototype's clothing size guide becomes a "Compatibility guide" modal for pods and machines (which capsules fit which machine) and a grind guide for coffee.

#### Scenario: Required choice missing
- **GIVEN** a coffee with no grind chosen
- **WHEN** the add button renders
- **THEN** it reads "Select a grind" and is disabled

#### Scenario: Incompatible combination
- **GIVEN** a machine page and a Vertuo pod in the bundle
- **WHEN** the pair is not compatible
- **THEN** it is not offered, rather than offered and rejected at the cart

### Requirement: Fulfilment choice

The system SHALL offer "How would you like it?" as option cards: Collect (free, ready in about {n} minutes), Ship (free over the threshold, 2 to 4 days) and Subscribe & save (deliver every {interval}, skip or cancel any time, saving shown). Subscribe appears only for subscribable products; machines never offer it. Subscribe is new design (`design.md` section 6).

- Collect shows a bordered block with a status dot, "In stock at {store}" or "Unavailable", address, distance, "Ready today, in about {n} minutes" in teal, and a Change link to the store picker.
- Ship shows "Order in the next {h} hours for delivery by {day}".
- Subscribe shows an interval select and the recurring price.

#### Scenario: Out of stock for collection
- **GIVEN** the item is unavailable at the chosen store
- **WHEN** Collect is selected
- **THEN** the status shows Unavailable, the add button reads "Unavailable for collection", and switching to Ship re-enables it

#### Scenario: Variant out of stock at store
- **GIVEN** Collect is selected
- **WHEN** a variant is out of stock at that store
- **THEN** that option is disabled with the title "Not available for collection at this store"

### Requirement: Add to bag

The system SHALL show a stepper and a large add button whose label reflects state: "Select a {choice}", "Unavailable for collection", "Reserve for collection", "Add to bag" or "Subscribe", suffixed with the line total when enabled. Adding toasts "Added to bag" and updates the header count.

#### Scenario: Reserve
- **GIVEN** Collect is selected and in stock
- **WHEN** the button is pressed
- **THEN** a collect-fulfilment line is added for the chosen store

### Requirement: Trust row and details

The system SHALL show returns, quality guarantee and responsibly-sourced items under the button, then accordions: Details (open by default; origin, notes, intensity or specifications), Brewing and care (descaling, storage, capsule recycling), and Shipping and collection.

#### Scenario: Accordion
- **GIVEN** an accordion header
- **WHEN** it is pressed
- **THEN** it toggles with a chevron change and an entrance animation

### Requirement: Related products and reviews

The system SHALL show "You may also like" (same category first, filled to four) and the reviews section of `reviews-and-ratings` (summary, distribution, list, write a review; new, VELA shows rating only). For machines, a "Goes well with" strip of compatible capsules is shown first.

#### Scenario: Machine
- **GIVEN** a Nespresso machine page
- **WHEN** related products render
- **THEN** compatible capsules lead the list

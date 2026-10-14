## ADDED Requirements

### Requirement: Malva listing over the whole catalog

The system SHALL render a listing at `/{locale}/categories/{slug}` for any category slug, searching all published products of the master catalog with no store, channel or product-selection scope. An unknown slug SHALL answer with the not-found page. The listing SHALL use the header of the Malva home and SHALL support sort, pagination and the brand filter held in the address as the reseller listing does. The fit filter is applied only when a garage vehicle exists.

#### Scenario: A category
- **GIVEN** `/en-US/categories/brakes`
- **WHEN** it is requested
- **THEN** products of the whole catalog in Brakes and its subtree are listed with the result count

#### Scenario: Unknown category
- **GIVEN** `/en-US/categories/nope`
- **WHEN** it is requested
- **THEN** the not-found page shows

### Requirement: Cards without price, stock or detail page

The system SHALL render each Malva card with a 4:3 image, uppercase brand, name (two lines at most), part number and fit badge. It SHALL NOT render a price, an old price, a stock line, a shipping promise or an Add to cart button, and SHALL NOT link the image or name anywhere, because there is no product detail page at Malva level.

#### Scenario: Card content
- **GIVEN** any product in a listing
- **WHEN** its card renders
- **THEN** it shows image, brand, name, part number and fit badge and no price or stock text

#### Scenario: No navigation from the card
- **GIVEN** a card
- **WHEN** the image or name is clicked
- **THEN** nothing navigates

### Requirement: Select a reseller

The system SHALL show a full-width "Select a reseller" button on every card instead of Add to cart. Choosing it SHALL open the finder drawer from the side with the product remembered, and SHALL NOT change the address.

#### Scenario: Open the drawer
- **GIVEN** a card for part SK-1001
- **WHEN** "Select a reseller" is pressed
- **THEN** a drawer slides in from the side with the finder, focus moves into it, and Escape closes it and returns focus to the button

### Requirement: Listing states

The system SHALL show a loading skeleton, an empty state ("No parts in this category") and an error state with retry, and SHALL keep the page usable when the search fails.

#### Scenario: Search failure
- **GIVEN** the search request fails
- **WHEN** the listing renders
- **THEN** the error state with a retry control shows and the header and finder still work

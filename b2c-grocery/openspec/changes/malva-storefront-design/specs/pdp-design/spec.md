## ADDED Requirements

### Requirement: Gallery and sticky buy box

The product page SHALL show a two-column layout (1.15fr/1fr): a gallery with one 600px primary image spanning two columns and two 290px secondary images, and a buy box that stays sticky below the header at ≥1200px.

#### Scenario: Scroll on desktop
- **WHEN** a visitor scrolls the page at 1440px
- **THEN** the buy box remains in view beside the gallery

### Requirement: Product identity, price and description

The buy box SHALL show category and reference tags, a 48px name, the maker line, the price in the heading font at 30px, and a description. The brand SHALL be shown when present, the original price and saving SHALL be shown when a reduced price exists, and a rating SHALL be shown only when review data exists.

#### Scenario: Saving shown
- **WHEN** the product has a reduced price
- **THEN** the original price and saving appear next to the price

### Requirement: Option selectors

The page SHALL generate its selectors from the product type's variant attributes: weight increments (`packLabel`) as a segmented control, and any other variant attribute as a segmented control, swatches (when a color/swatch mapping exists) or radios per the variant configuration (blocklist, swatch, sort order). Selecting a combination SHALL select a variant and drive price, availability and image where variant-specific.

#### Scenario: Select an increment
- **WHEN** a visitor picks "1 kg"
- **THEN** it is marked selected and price, unit price and availability reflect that variant

#### Scenario: Unavailable option
- **WHEN** an option has no purchasable variant
- **THEN** it is shown disabled

### Requirement: Add to bag and save

The page SHALL show a quantity stepper (minimum 1), a primary "Add to bag" button and a heart control. Adding SHALL add the chosen quantity, show the toast, and update the header count once.

#### Scenario: Add three
- **WHEN** quantity is 3 and the visitor adds to bag
- **THEN** the bag gains 3 of the variant and one toast appears

#### Scenario: Out of stock
- **WHEN** the variant is out of stock
- **THEN** the add button is disabled and availability says so

### Requirement: Availability, specifications and stylist note

The page SHALL show availability ("In stock" or "Out of stock"), a specification table (Brand, Origin, Storage, Dietary, Allergens) that is open or collapsed per setting, and an optional "Questions? Contact us" strip.

#### Scenario: Out of stock variant
- **WHEN** the selected variant is unavailable
- **THEN** availability says "Out of stock" and add to bag is disabled

### Requirement: Related products and reviews

The page SHALL show a "Pairs with" four-column grid of related products and a reviews block that renders only when the product has review data (average, count, distribution, review cards) and is omitted otherwise.

#### Scenario: Related click
- **WHEN** a visitor opens a related product
- **THEN** the new product page opens with quantity reset to 1

### Requirement: Availability check on add

Add to bag and quantity changes SHALL check available quantity from `ProductVariantAvailability` before calling the cart API because carts use inventory mode None; insufficient stock SHALL show a message with the maximum available.

#### Scenario: Ask for more than available
- **WHEN** a shopper adds 5 of a variant with 3 available
- **THEN** nothing is added and a message states that 3 are available

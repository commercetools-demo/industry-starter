## ADDED Requirements

### Requirement: Gallery and sticky buy box

The product page SHALL show a two-column layout (1.15fr/1fr): a gallery with one 600px primary image spanning two columns and two 290px secondary images, and a buy box that stays sticky below the header at ≥1200px.

#### Scenario: Scroll on desktop
- **WHEN** a visitor scrolls the page at 1440px
- **THEN** the buy box remains in view beside the gallery

### Requirement: Product identity, price and description

The buy box SHALL show category and reference tags, a 48px name, the maker line, the price in the heading font at 30px, and a description. Optional brand, rating and saving display SHALL follow block settings.

#### Scenario: Saving shown
- **WHEN** `showSaving` is on and the product has a reduced price
- **THEN** the original price and saving appear next to the price

### Requirement: Option selectors

The page SHALL offer finish as 44px swatches with the selected name beside the label, size as a segmented control, and fitting as radios, and the selected variant SHALL drive price, availability and image where variant-specific.

#### Scenario: Select a finish
- **WHEN** a visitor picks a finish swatch
- **THEN** a ring marks it, its name is shown, and price and availability reflect the variant

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

The page SHALL show availability with a note (for example "In stock · ships in 3 days" or "Made to order · 6–8 weeks"), a specification table (Maker, Reference, Material, Lead time, Care) that is open or collapsed per setting, and an optional stylist strip.

#### Scenario: Made to order
- **WHEN** the product is made to order
- **THEN** availability shows the lead time and the bag later repeats it

### Requirement: Related products and reviews

The page SHALL show a "Pairs with" four-column grid of related products and a reviews block with average, count, star distribution, a "Write a review" action and review cards.

#### Scenario: Related click
- **WHEN** a visitor opens a related product
- **THEN** the new product page opens with quantity reset to 1

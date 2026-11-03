## ADDED Requirements

### Requirement: Lines grouped by brand
The cart drawer and cart page SHALL render one section per brand, current brand first, with one shared order total and checkout action. When the bag holds lines of more than one brand, each section SHALL show the brand name and a brand subtotal; a bag of one brand keeps the unchanged single-brand layout.

#### Scenario: Two sections
- **WHEN** the cart has coffee and drinks lines
- **THEN** two sections show with their subtotals and a single checkout button

#### Scenario: One brand only
- **WHEN** the cart has only drinks lines
- **THEN** one drinks section shows and no empty coffee section

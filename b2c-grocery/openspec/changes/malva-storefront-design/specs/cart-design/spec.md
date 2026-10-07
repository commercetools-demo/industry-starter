## ADDED Requirements

### Requirement: Bag layout

The cart page SHALL be titled "Your bag" (52px) with lines on the left and a sticky summary card on the right in a 1.5fr/1fr grid at ≥1200px.

#### Scenario: Desktop bag
- **WHEN** the bag has lines at 1440px
- **THEN** lines and a sticky summary render side by side

### Requirement: Bag lines

Each line SHALL show a 150×180 image, name, line total, maker, a stock tag ("In stock" or "Out of stock"), a quantity stepper (minimum 1) and a ghost "Remove" button.

#### Scenario: Increase quantity
- **WHEN** a visitor increases a line's quantity
- **THEN** line total, subtotal, delivery and total update, and revert if the update fails

#### Scenario: Remove line
- **WHEN** a visitor removes a line
- **THEN** it disappears and an undo toast is offered

### Requirement: Summary

The summary SHALL show subtotal, delivery with the selected slot ("Included" when free), a divider, the total in the heading font at 24px, a primary "Checkout" button and the returns note. Totals SHALL be the server cart's values, and thresholds and prices SHALL come from configuration.

#### Scenario: Free delivery
- **WHEN** the subtotal meets the configured threshold
- **THEN** delivery reads "Included" and is excluded from the total

### Requirement: Empty bag

An empty bag SHALL show "Your bag is empty." and a primary "Browse the shop" button, and Checkout SHALL be unavailable.

#### Scenario: Empty
- **WHEN** the last line is removed
- **THEN** the empty message and browse button appear

### Requirement: Unavailable lines

A line that becomes unavailable SHALL show an inline notice and block Checkout until resolved. (Proposed; not drawn.)

#### Scenario: Out of stock line
- **WHEN** a line goes out of stock
- **THEN** the line shows a notice and the Checkout button is disabled

### Requirement: Saved items

The saved screen SHALL show "N pieces saved" with the heading "Put aside" and a four-column grid of cards with image, name, maker, price, "Add to bag" and "Remove"; when empty it SHALL invite the visitor to browse.

#### Scenario: Move to bag
- **WHEN** a visitor clicks "Add to bag" on a saved card
- **THEN** the item is added and the toast appears

### Requirement: Pre-checkout delivery step

The cart SHALL include the delivery address, slot picker, per-line substitution preference and provisional-total notice as specified in `delivery-slot-experience`, `substitution-experience` and `weight-pricing-experience`; "Checkout" SHALL be disabled until a deliverable address and a slot are set.

#### Scenario: Incomplete delivery step
- **WHEN** no slot is selected
- **THEN** the Checkout button is disabled with an explanation

## ADDED Requirements

### Requirement: The assistant writes to the shopper's bag
The assistant SHALL read and edit the shopper's bag (`malva-session.cartId`) through the storefront cart module, with the shopper's own session. There is no separate assistant cart and no adopt step (workstream T2, D-055).

#### Scenario: First add
- **GIVEN** a shopper whose bag exists
- **WHEN** the shopper asks to add a seen variant
- **THEN** the line is added to the bag and the header badge shows it at once

#### Scenario: No bag made in a turn
- **GIVEN** the session has no bag
- **WHEN** the assistant adds an item
- **THEN** the add says the bag was reset and no bag is created in the turn

### Requirement: Edits are read-modify-write
Because `update_cart` replaces all lines, add, set-quantity and remove SHALL read the cart, merge the change and send the complete line list, serialised per session. After a write the cart SHALL be re-read and a missing expected line retried once.

#### Scenario: Add keeps other lines
- **GIVEN** a cart with lines A and B
- **WHEN** C is added
- **THEN** the `update_cart` call carries A, B and C

#### Scenario: Remove last line
- **WHEN** the only line is removed
- **THEN** the cart is cancelled with `cancel_cart` (or updated to empty if the live server accepts that) and `agentCartId` is cleared

#### Scenario: Update of a product not in the cart
- **WHEN** a quantity change names a product the cart does not hold
- **THEN** the cart is returned unchanged and no error is raised

### Requirement: Not orderable is reported with ids only
`line_item_not_orderable` SHALL produce the unavailable signal naming ids, and for a variant the in-stock sibling ids the catalogue read supplies; titles stay inside fences.

#### Scenario: Out of stock
- **WHEN** an add is refused as not orderable
- **THEN** the model is told which id is unavailable and the cart is unchanged

### Requirement: Checkout summary is cent-exact
The checkout card SHALL be built from the storefront cart totals (`total` in minor units) formatted with the storefront's money formatter. It SHALL show lines, a discount row only when the storefront supplies a non-zero discount total, and the payable total; it SHALL NOT show shipping, tax or estimated rows the storefront did not supply, and SHALL NOT print "calculated at checkout".

#### Scenario: Totals shown as given
- **WHEN** the bag total is 4297 USD
- **THEN** the card shows $42.97

#### Scenario: Not charged
- **THEN** the card carries the "not charged" pill with its `aria-describedby` wiring

### Requirement: Card actions bypass the model but not the gates
A card's Add button SHALL call a card route (not a chat turn) that applies the quantity cap and the options hold but not provenance. A family card SHALL route its add to the assistant instead of adding an unbuyable id.

#### Scenario: Family tile
- **WHEN** the shopper presses Add on a product with several variants
- **THEN** no cart write happens and the assistant is asked which option

#### Scenario: Revalidation
- **WHEN** a card add succeeds
- **THEN** the analytics add event fires once, after the server confirmed, and the assistant cart view is refreshed without opening the mini-cart

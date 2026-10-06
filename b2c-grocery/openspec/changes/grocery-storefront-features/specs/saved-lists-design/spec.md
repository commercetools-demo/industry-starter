## ADDED Requirements

### Requirement: Sign-in gated saving

The heart control on tiles and the product page SHALL save the product to the signed-in customer's shopping list (key `wishlist-<customerId>`). For anonymous visitors it SHALL open sign-in with a `redirect` back and complete the save after return.

#### Scenario: Anonymous heart click
- **WHEN** an anonymous visitor clicks the heart
- **THEN** they are sent to sign-in and the product is saved after they return

#### Scenario: Toggle
- **WHEN** a signed-in customer clicks a filled heart
- **THEN** the product is removed from the list and the heart returns to outline

### Requirement: Saved page

`/[locale]/account/saved` SHALL show "N pieces saved" under the heading "Put aside" with a four-column grid of cards (image, name, price, "Add to bag", "Remove") and an empty state with a browse link.

#### Scenario: Empty list
- **WHEN** nothing is saved
- **THEN** the empty message and browse button appear

### Requirement: Add to bag from saved

"Add to bag" SHALL add the default variant when the product has a single variant and otherwise open the product page; out-of-stock products SHALL show the button disabled with "Out of stock".

#### Scenario: Out of stock saved item
- **WHEN** a saved product is out of stock
- **THEN** its button is disabled and labelled accordingly

### Requirement: Heart state per session

Heart fill state SHALL be resolved per session on the client and never cached in shared markup.

#### Scenario: Cached page
- **WHEN** a cached listing is served to a signed-in customer
- **THEN** hearts reflect their own saved list after hydration

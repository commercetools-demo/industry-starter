## ADDED Requirements

### Requirement: Account dashboard layout

The account page SHALL show a kicker ("Member since …"), the customer name as a 52px heading, and a 1.6fr/1fr grid with the orders table on the left and cards on the right.

#### Scenario: Signed-in customer
- **WHEN** a signed-in customer opens the account
- **THEN** their name, orders and cards render

#### Scenario: Anonymous visitor
- **WHEN** no session exists
- **THEN** the visitor is sent to sign-in and returned afterwards

### Requirement: Orders table

The orders table SHALL have columns Piece, Reference, Placed and a right-aligned Status shown as a tag: neutral for delivered, accent for in production, accent-2 for shipped or packing, and neutral for unknown states.

#### Scenario: Status mapping
- **WHEN** an order is in production
- **THEN** its status tag uses the accent style

#### Scenario: No orders
- **WHEN** the customer has no orders
- **THEN** the table is replaced by "No orders yet" and a browse button

### Requirement: Address and details cards

The dashboard SHALL show a default-address card with an "Edit" action and a details card listing Addresses, Payment methods, Returns, Concierge and Trade programme as rows with trailing arrows that turn accent on hover.

#### Scenario: Open payment methods
- **WHEN** a customer selects "Payment methods"
- **THEN** the payment methods page opens

### Requirement: Account sub-pages follow shared patterns

Sub-pages (order detail, address book, payment methods, sign-in, registration, password reset) SHALL reuse the shared components: addresses as cards with dialog editing, payment methods as rows with removal, authentication forms as centred cards with block primary buttons. (Proposed; not drawn.)

#### Scenario: Edit address
- **WHEN** a customer chooses "Edit" on an address card
- **THEN** a dialog with labelled fields opens

### Requirement: Account data is never shared

Account-specific content SHALL be resolved per session and SHALL NOT appear in cached responses or to other sessions.

#### Scenario: Shared cache
- **WHEN** an account page is requested
- **THEN** the response is marked non-cacheable for shared caches

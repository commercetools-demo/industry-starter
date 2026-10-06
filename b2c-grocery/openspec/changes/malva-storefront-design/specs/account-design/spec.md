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

The orders table SHALL have columns Items, Order number, Placed, Total and a right-aligned Status shown as a tag: neutral for delivered or unknown, accent for processing, accent-2 for packing or on its way; each row SHALL link to the order detail.

#### Scenario: Status mapping
- **WHEN** an order is processing
- **THEN** its status tag uses the accent style

#### Scenario: No orders
- **WHEN** the customer has no orders
- **THEN** the table is replaced by "No orders yet" and a browse button

### Requirement: Address and details cards

The dashboard SHALL show a default-address card with an "Edit" action and a details card listing Orders, Addresses, Saved lists, Subscriptions and Contact us as rows with trailing arrows that turn accent on hover.

#### Scenario: Open addresses
- **WHEN** a customer selects "Addresses"
- **THEN** the address book opens

### Requirement: Account sub-pages follow shared patterns

Sub-pages (order detail, address book, saved lists, subscriptions) SHALL reuse the shared components and are specified in `grocery-storefront-features`; there is no payment methods or profile page in v1. (Proposed; not drawn.)

#### Scenario: Edit address
- **WHEN** a customer chooses "Edit" on an address card
- **THEN** a dialog with labelled fields opens

### Requirement: Account data is never shared

Account-specific content SHALL be resolved per session and SHALL NOT appear in cached responses or to other sessions.

#### Scenario: Shared cache
- **WHEN** an account page is requested
- **THEN** the response is marked non-cacheable for shared caches

### Requirement: Order detail

`/[locale]/account/orders/[orderId]` SHALL show the order number, date, status tag, delivery slot, lines with image, name, quantity, unit and line total, substitution preference per line, any pending substitution proposal, totals (with provisional label when applicable and final amount when recorded) and the shipping address.

#### Scenario: Another customer's order
- **WHEN** a customer opens an order id that is not theirs
- **THEN** a not-found page is shown

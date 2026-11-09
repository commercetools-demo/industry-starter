## ADDED Requirements

### Requirement: Order tools need a signed-in shopper
The order list and the single-order read SHALL work only when the agent session's principal has a `customerId` from the signed cookie. A guest asking about an order SHALL be told to sign in, and no order read is made.

#### Scenario: Guest
- **GIVEN** an anonymous session
- **WHEN** the shopper asks "where is my order"
- **THEN** the assistant asks them to sign in and `get_order` is not called

### Requirement: Only the shopper's own orders
Before a `get_order` call the host SHALL confirm the order number is the signed-in shopper's, by the storefront's existing customer-scoped account read. A number that is not theirs, or unknown, SHALL return the same "not found" result.

#### Scenario: Someone else's order
- **GIVEN** a valid order number belonging to another customer
- **WHEN** the shopper asks about it
- **THEN** the answer is indistinguishable from an unknown number and no order read is made

#### Scenario: Order number or id
- **WHEN** the shopper gives the order number (`MC-` followed by ten characters, optionally a suffix letter)
- **THEN** it is accepted; model-supplied text is validated against that pattern before any call

### Requirement: Recent orders without a search
`get_orders(limit)` SHALL return the shopper's most recent orders (newest first, at most 5) so "my last order" and a reorder need no number. Their items SHALL enter provenance.

#### Scenario: Last order
- **WHEN** the shopper asks "what did I order last time"
- **THEN** the newest order is read and its lines are available to add to the assistant cart

### Requirement: Status mapping in precedence order
Order and line state SHALL map to the agent's status enum in the order refund, return, cancelled, delayed, shipped, complete, processing. A confirmed order not yet shipped is `processing`. A value the mapping does not know SHALL NOT be shown as a status; the assistant answers in prose.

#### Scenario: Unknown line status
- **WHEN** the storefront returns a status the mapping lacks
- **THEN** the order-status card is not rendered and the result tells the model to describe it in words

### Requirement: Facts come from the storefront only
Delivery estimate and tracking SHALL be absent unless the storefront returns them. The "View order" link SHALL be the same-origin account page `/<brand>/<locale>/account/orders/<orderNumber>`; a tracking link SHALL be kept only when it is `https`.

#### Scenario: No estimate
- **WHEN** the order carries no delivery estimate
- **THEN** the card shows none and the assistant does not invent one

### Requirement: Order totals match the account pages
The totals on an order card SHALL come from the storefront order total in minor units, formatted with the storefront formatter.

#### Scenario: Total shown
- **WHEN** the order total is 2399 USD
- **THEN** the card shows $23.99

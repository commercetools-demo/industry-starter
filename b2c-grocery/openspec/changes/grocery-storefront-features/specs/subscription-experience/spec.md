## ADDED Requirements

### Requirement: Cadence selection on recurring-eligible products

The product page SHALL offer, for recurring-eligible products only, a "Repeat" selector with "One-time" (default) and the project's recurrence policies (weekly, every 2 weeks, monthly). Choosing a policy SHALL add the line item with `recurrenceInfo` using that policy and `priceSelectionMode = Dynamic`.

#### Scenario: Subscribe
- **WHEN** a shopper picks "Every 2 weeks" and adds to bag
- **THEN** the line item carries the policy and Dynamic price selection and the cart line shows "Repeats every 2 weeks"

#### Scenario: Ineligible product
- **WHEN** a product is not recurring-eligible
- **THEN** no selector is shown

### Requirement: Plain-words price notice

Wherever a cadence is chosen the page SHALL say that the price of each repeat order follows the current price and may change.

#### Scenario: Notice shown
- **WHEN** a cadence other than "One-time" is selected
- **THEN** the notice is visible next to the selector and in the cart line

### Requirement: Recurring orders list

The account SHALL list recurring orders with items, cadence, state and next order date, and show an empty state with a link to the shop when none exist.

#### Scenario: Active recurring order
- **WHEN** a customer has an active recurring order
- **THEN** the list shows its next order date

### Requirement: Manage in place

The customer SHALL be able to change cadence, change quantities, pause and cancel a recurring order without recreating it; changes SHALL apply from the next generated order and cancel/pause SHALL state when the last order was generated.

#### Scenario: Change cadence
- **WHEN** the customer changes the cadence
- **THEN** the same recurring order shows the new schedule and next date

#### Scenario: Cancel
- **WHEN** the customer cancels
- **THEN** no further orders are generated and the page states the date of the last one

### Requirement: Checkout compatibility gate

If the hosted Checkout cannot create Recurring Orders from carts with `recurrenceInfo`, the cadence selector SHALL be hidden and the owner informed before work continues (risk R-1).

#### Scenario: Spike fails
- **WHEN** the spike shows no recurring order is created at checkout
- **THEN** the selector is disabled behind a flag and a question is raised to the owner

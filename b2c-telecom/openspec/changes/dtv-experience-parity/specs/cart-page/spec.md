## ADDED Requirements

### Requirement: Bundle shows what was applied and what recurs

The cart page ("My bundle") SHALL list the applied promotions as specified in `first-order-promotions` (under a single affected line, after the lines otherwise), SHALL show the summary rows of `pricing-consistency` that add up to Due today, and SHALL show "Then monthly" separately below Due today.

#### Scenario: Promotions visible
- **GIVEN** a cart with the first-month promotion and `WELCOME10`
- **WHEN** the cart page renders
- **THEN** the first-month promotion is shown under its line, `WELCOME10` is listed after the lines, and each shows its amount off

#### Scenario: Discount stops applying
- **GIVEN** a promotion in the list
- **WHEN** the buyer removes the line it depended on
- **THEN** the promotion disappears, and Due today and Then monthly update from the engine

#### Scenario: Reader adds the rows
- **GIVEN** the order summary
- **WHEN** the rows above Due today are added
- **THEN** the sum equals Due today to the cent

### Requirement: Cart reached from the finder keeps its context

The cart opened by the plan finder's Continue SHALL show the same buyer context (customer type, existing customer, location) as the finder and SHALL offer a link back to the finder with the plan preselected.

#### Scenario: Back to the finder
- **GIVEN** `/bundle` opened from Continue with plan A
- **WHEN** the buyer chooses "Back to plan finder"
- **THEN** the finder opens with plan A selected and the same context

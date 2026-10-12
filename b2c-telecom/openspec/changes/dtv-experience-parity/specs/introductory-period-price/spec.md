## ADDED Requirements

### Requirement: The first month is the only opening period

The system SHALL offer one opening period, the first month, expressed as the first-month promotion of `first-order-promotions`, and the plan's price schedule SHALL show it as its own first period ("First month, free") followed by the standing period with its start date. The schedule SHALL NOT contain reduced-price intro periods or stepped periods for newly placed orders.

#### Scenario: Schedule of a promoted plan
- **GIVEN** Cable 100 on a 24-month term with the first-month promotion, ordered on 2026-10-12
- **WHEN** the price schedule is built
- **THEN** period 1 is "First month" at $0 and the standing period starts on the date one month after the order date at $39.99, and "Due at order" equals the cart's line total plus the activation fee

#### Scenario: Schedule of a plan without the promotion
- **GIVEN** Cable 500 with no first-month promotion
- **WHEN** the schedule is built
- **THEN** it has a single standing period

#### Scenario: Schedule agrees with the cart
- **GIVEN** a cart with the promotion
- **WHEN** the bundle shows "Due today" and the schedule shows "Due at order"
- **THEN** the two agree

#### Scenario: Contract total
- **GIVEN** the 24-month schedule above
- **WHEN** the total over the term is shown
- **THEN** it counts the first month at $0 and the other 23 months at the standing price, and does not count the free month at any other amount

### Requirement: Free first month ends on recurring orders by construction

The first-month promotion SHALL end on recurring orders because its Cart Discount is `NonRecurringOrdersOnly`, and the system SHALL verify with a spike on a real recurring order that the second and later generated orders carry the standing price.

#### Scenario: Second order at standing price
- **GIVEN** an order placed with the first-month promotion on a monthly recurring line
- **WHEN** the second recurring order is generated
- **THEN** its plan line is the standing price

#### Scenario: Mismatch is detected
- **GIVEN** a generated order whose line total differs from the standing amount stored on the original order
- **WHEN** the reconciliation report runs
- **THEN** the order is listed with both amounts

### Requirement: Older schedules still display

Orders stamped before this change with intro or step periods SHALL still display their stored schedule unchanged, and the schedule library SHALL keep reading those periods.

#### Scenario: Old order with an intro period
- **GIVEN** an order whose stored schedule has an intro period and a standing period
- **WHEN** it is opened in the account
- **THEN** both periods and the stored contract total are shown as stored

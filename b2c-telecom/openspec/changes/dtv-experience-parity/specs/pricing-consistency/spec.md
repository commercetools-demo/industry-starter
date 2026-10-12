## ADDED Requirements

### Requirement: Recurring amounts are the standing price

The system SHALL state every recurring amount ("Then monthly", the order's "monthly after that", the checkout "Monthly after today", the stored schedule's standing period and the contract total) as the engine-selected recurring price of the line for the buyer's market, customer group and channel, times quantity, and SHALL NOT subtract any promotion from it, because promotions apply to the first order only (see `first-order-promotions`). The same amount SHALL appear on the card, in the finder, in the bundle, at checkout, on the confirmation and in the order history.

#### Scenario: Cart, checkout and order agree
- **GIVEN** a cart with a cable plan with the first-month promotion, a router rental and a phone plan
- **WHEN** the bundle, the checkout review, the confirmation and the account order list state the recurring monthly total
- **THEN** all four show the same amount, equal to the sum of the lines' standing prices

#### Scenario: List price and standing price are the same thing
- **GIVEN** a price selected for a customer group
- **WHEN** the schedule's standing amount is stored
- **THEN** it is the group's price from the engine's selection (the line's `price.value`), not a catalog default

#### Scenario: Add-ons and plans use one basis
- **GIVEN** a cart with a plan and an add-on
- **WHEN** "Then monthly" is computed
- **THEN** both lines use their standing price, never one list-based and one net

#### Scenario: A recurring discount appears
- **GIVEN** a cart discount that applies to recurring orders and was created in the Merchant Center
- **WHEN** a cart it applies to is read
- **THEN** the catalog lint warns, and the bundle shows a notice on the affected line that its price changes on later orders, rather than showing a figure that recurring orders will not charge

### Requirement: Summary rows foot to Due today

The system SHALL present the order summary as rows whose sum equals Due today: Plans (first month, net of line promotions), Add-ons and equipment (net), Devices (net), One-time fees, Order-level discounts (negative, only discounts that apply to the order total), Shipping, Tax (when not included in price), then Due today. "Then monthly" SHALL be a separate line below Due today and SHALL NOT be one of the summed rows. A separate informational line "You save <amount>" MAY state the total of all promotions and SHALL NOT be a summed row.

#### Scenario: Line promotions are not subtracted twice
- **GIVEN** a cart in which the first-month promotion already reduced the Plans row by $39.99
- **WHEN** the summary renders
- **THEN** no "Discounts" row of -$39.99 is among the summed rows, and "You save $39.99" is shown separately

#### Scenario: Order-level code is a row
- **GIVEN** `WELCOME10` applied to the order total
- **WHEN** the summary renders
- **THEN** a "Discounts" row of -$10.00 is among the summed rows and Due today is $10.00 lower

#### Scenario: Rows add up
- **GIVEN** any cart summary
- **WHEN** a reader adds the rows above Due today
- **THEN** the result equals Due today to the cent

#### Scenario: Then monthly is separate
- **GIVEN** a cart with the first-month promotion
- **WHEN** the summary renders
- **THEN** Due today and "Then monthly" differ, and "Then monthly" is labelled as what later orders will be charged

#### Scenario: Checkout summary uses the same rows
- **GIVEN** the checkout summary
- **WHEN** it renders
- **THEN** it uses the same row definition and the same figures as the bundle

### Requirement: Tax inside Due today

The system SHALL include tax in Due today when the tax rate is not included in the price, and SHALL state "includes <amount> tax" when it is.

#### Scenario: Tax added
- **GIVEN** a US cart whose rate is not included in price
- **WHEN** Due today is shown
- **THEN** it equals the rows above it including the tax row

#### Scenario: Tax included
- **GIVEN** a Germany cart whose rate is included in price
- **WHEN** the summary renders
- **THEN** the tax is stated as included and is not added again

### Requirement: Discount amounts come from the engine

The system SHALL compute the promotion amount shown for a line or the order from the engine's reported discounted amounts, not from `max(0, list × quantity − total)`.

#### Scenario: Financed device line
- **GIVEN** a financed device line whose list price comes from a different field than a plan line's
- **WHEN** the promotion amount is shown
- **THEN** it equals the engine's reported amount for that line

#### Scenario: Line above list after rounding
- **GIVEN** a line whose total is above its list price after rounding
- **WHEN** the amount is shown
- **THEN** it shows the engine's value (zero if none) and no other line's amount changes

### Requirement: Discount rank follows the platform direction

The system SHALL set the `sortOrder` of every seeded cart discount so that the platform's actual application order (a higher value applies first) equals the intended order, SHALL document the intended order in one table in the seed, and SHALL test it against an engine-priced cart.

#### Scenario: Code after the promotion
- **GIVEN** Cable 100 with the first-month promotion and the `MALVA-CABLE5` code
- **WHEN** the cart is priced
- **THEN** the amounts equal the intended order of application written in the seed table, and no line goes below zero

#### Scenario: Test fails on drift
- **GIVEN** a discount added with a `sortOrder` that breaks the intended order
- **WHEN** the seed test runs
- **THEN** it fails and names the discount

### Requirement: Free shipping evaluated by the engine

The system SHALL NOT re-implement shipping-rate thresholds in the storefront. Free-shipping rules SHALL be expressed in the shipping method's rates and evaluated by commercetools, and the currency of any fallback SHALL come from the cart.

#### Scenario: Threshold in the platform
- **GIVEN** a shipping method with a free-above rate
- **WHEN** a cart crosses the threshold
- **THEN** the shipping price shown is the one the engine returned for that cart

### Requirement: Consistent money formatting by surface

The system SHALL use one rule for decimals per purpose: monthly prices on cards MAY drop `.00`, and every amount in a total or summary row SHALL show two decimals, and both SHALL state the same value for the same price.

#### Scenario: Card and cart agree
- **GIVEN** a $55 plan
- **WHEN** the card shows "$55" and the cart shows "$55.00"
- **THEN** both are the same amount, and a $55.99 plan shows "$55.99" on both

#### Scenario: Card shows the promotion
- **GIVEN** a plan with the first-month promotion
- **WHEN** its card renders
- **THEN** it states the promotion and the standing price, so the cart does not reveal it first

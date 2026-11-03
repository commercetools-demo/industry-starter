## ADDED Requirements

### Requirement: Drinks are delivery only
Malva Drinks products SHALL be available for delivery only, with stock read from the drinks inventory channel; collection store stock SHALL NOT apply to them.

#### Scenario: Collect offered
- **WHEN** the drinks PDP renders in the US market
- **THEN** no collect option is shown even though stores exist

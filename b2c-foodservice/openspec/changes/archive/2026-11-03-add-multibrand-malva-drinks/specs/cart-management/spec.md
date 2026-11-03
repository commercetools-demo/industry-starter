## ADDED Requirements

### Requirement: Brand on every line
Each cart line item SHALL carry a `brand` custom field on the existing line custom type, set by the BFF from the product's brand (selection membership), never from client input alone. A line without the field SHALL be treated as `malva-coffee`.

#### Scenario: Mixed cart
- **WHEN** a visitor adds one coffee and one drinks product
- **THEN** one cart holds two lines with brands `malva-coffee` and `malva-drinks`

### Requirement: Brand channel is not a collection store
A line whose supply channel is a brand inventory channel SHALL be classified by its `fulfilment` field (`delivery`) and SHALL NOT be treated as collect.

#### Scenario: Drinks line classification
- **WHEN** a drinks line has the drinks channel and no `fulfilment` field
- **THEN** it is classified as delivery

### Requirement: Brand preserved across cart operations
Quantity change, fulfilment switch, market carry-over and reorder SHALL preserve each line's brand.

#### Scenario: Market switch
- **WHEN** a visitor with a mixed cart switches market
- **THEN** carried-over lines keep their brands

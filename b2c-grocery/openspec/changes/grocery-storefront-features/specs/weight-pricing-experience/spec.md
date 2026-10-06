## ADDED Requirements

### Requirement: Unit price display

Tiles, product page and cart lines for goods with an `incrementUnit` other than `each` SHALL show the increment price and a unit price per kg or per litre computed as price ÷ increment, formatted with `formatMoney`, for example "€2.40 · €4.80 / kg".

#### Scenario: 500 g pack
- **WHEN** a 500 g variant costs €2.40
- **THEN** the tile shows "€2.40" and "€4.80 / kg"

#### Scenario: Each item
- **WHEN** a variant has `incrementUnit = each`
- **THEN** no per-unit line is shown

### Requirement: Increment selection

The product page SHALL present the product's increments (for example 250 g, 500 g, 1 kg) as the size control, selecting by variant, and the cart SHALL only allow integer quantities of the chosen increment.

#### Scenario: Pick an increment
- **WHEN** the shopper selects "1 kg"
- **THEN** price, unit price and availability reflect that variant

### Requirement: Provisional total notice

When any cart line is a variant with `approximateWeight = true`, the cart summary, the order detail and the confirmation page SHALL label the total "Provisional" and state that the final amount depends on the picked weight. Carts with only exact lines SHALL show no such label.

#### Scenario: Approximate line present
- **WHEN** the cart contains an approximate-weight line
- **THEN** the summary total reads "Total (provisional)" with the explanatory note

#### Scenario: Exact lines only
- **WHEN** no line is approximate
- **THEN** the total is shown as exact

### Requirement: Final amount display

When an order has a custom field `finalTotal`, the order detail SHALL show the final amount and the difference from the provisional total; when absent it SHALL show nothing. No reconciliation pipeline is built in v1.

#### Scenario: Final amount recorded
- **WHEN** an order has `finalTotal`
- **THEN** order detail shows final amount and difference

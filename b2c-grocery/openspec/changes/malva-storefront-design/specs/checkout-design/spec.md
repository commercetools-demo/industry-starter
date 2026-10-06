## ADDED Requirements

### Requirement: Checkout layout

Checkout SHALL show a step kicker (for example "Step 2 of 3 · Delivery"), a 52px "Checkout" heading, and a 1.4fr/1fr grid of stacked form sections and a sticky order summary.

#### Scenario: Desktop checkout
- **WHEN** checkout opens at 1440px
- **THEN** form sections and a sticky summary render side by side

### Requirement: Contact and shipping address

Checkout SHALL collect first name, last name and email, and street, city and postcode, with visible labels and autocomplete attributes, prefilled for signed-in customers.

#### Scenario: Invalid email
- **WHEN** the email is invalid at submit
- **THEN** an inline error tied to the field is shown and the order is not placed

### Requirement: Delivery options

Checkout SHALL present delivery methods as radio cards with name, note and price, the selected card marked by accent border and `accent-100` fill, and selection SHALL immediately update the summary delivery line and total.

#### Scenario: Choose collection
- **WHEN** a customer selects "Collect in Paris"
- **THEN** delivery shows Free and the total updates

### Requirement: Payment

Checkout SHALL show the payment method in a bordered row with a "Change" action, backed by the real payment provider and never by demo values.

#### Scenario: Payment fails
- **WHEN** authorization fails
- **THEN** a banner appears above the payment section and no order is created

### Requirement: Order summary and placement

The summary SHALL list lines with thumbnail, name × quantity and total, then subtotal, delivery and total, and a primary "Place order" button that is disabled with a spinner while submitting and safe against double submit.

#### Scenario: Double click
- **WHEN** a customer clicks "Place order" twice
- **THEN** exactly one order is created

### Requirement: Order confirmation

After success the page SHALL show a centred confirmation with a check blob, the real order number kicker, a heading "Thank you, {first name}", next-steps copy, and "Track this order" and "Back to the shop" buttons.

#### Scenario: Track order
- **WHEN** a customer clicks "Track this order"
- **THEN** the account orders view opens

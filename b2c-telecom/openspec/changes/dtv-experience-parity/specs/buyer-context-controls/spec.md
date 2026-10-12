## ADDED Requirements

### Requirement: Buyer context bar on the plan finder

The plan finder SHALL show a buyer context bar with three controls: customer type (consumer, small business, employee), existing customer (yes, no, not specified) and service location (ZIP, with state and city). The bar SHALL show the effective value of each control, including values that come from a signed-in customer's account.

#### Scenario: Anonymous visitor defaults
- **GIVEN** an anonymous visitor
- **WHEN** the bar first renders
- **THEN** customer type is consumer, existing customer is "not specified" and the location is empty

#### Scenario: Signed-in customer values
- **GIVEN** a customer in the `small-business` and `existing-customer` groups
- **WHEN** the bar renders
- **THEN** it shows small business and existing customer yes, labelled "from your account", and the first two controls are read-only

#### Scenario: Signed-in customer changes location
- **GIVEN** the same signed-in customer
- **WHEN** they enter a ZIP
- **THEN** the location is stored and used, since location is not an account fact

### Requirement: Declared context for anonymous visitors

For an anonymous visitor, the system SHALL store the declared customer type, existing-customer value and location in a session cookie and SHALL resolve them in the buyer context (`lib/ct/buyer-context.ts`) for every surface and every cart write, so that eligibility, offers, prices and discounts agree. The declared audience SHALL be applied to the anonymous cart as the matching customer group. For a signed-in customer, the account's groups SHALL always govern and declared values SHALL be ignored.

#### Scenario: Declared type changes the list
- **GIVEN** an offer limited to employees and an anonymous visitor who declared consumer
- **WHEN** the visitor declares employee
- **THEN** the offer appears in the finder, in the category listing and in search for that session

#### Scenario: Existing customer yes, no, not specified
- **GIVEN** an offer restricted to existing customers and one restricted to new customers
- **WHEN** the visitor selects yes, then no, then not specified
- **THEN** the first appears for yes, the second for no, and with not specified only unrestricted offers appear

#### Scenario: Not specified is not the same as no
- **GIVEN** an offer with no existing-customer restriction
- **WHEN** the visitor selects no
- **THEN** the offer is still shown

#### Scenario: Cart agrees with the list
- **GIVEN** an anonymous visitor who declared employee and added an employee-only offer
- **WHEN** the cart is read and checkout starts
- **THEN** the offer is accepted, because the same declared context resolves in the cart guard and in checkout

#### Scenario: Declaration changed with a cart
- **GIVEN** a cart holding an employee-only offer
- **WHEN** the visitor changes the declared type to consumer
- **THEN** the cart is re-validated, the line is reported as no longer eligible, and the order cannot be placed on it

#### Scenario: Account governs
- **GIVEN** a signed-in consumer whose cookie says employee
- **WHEN** any surface resolves the buyer
- **THEN** the buyer is a consumer

#### Scenario: Cookie is not a credential
- **GIVEN** a request with a forged cookie value outside the allowed values
- **WHEN** the buyer context is resolved
- **THEN** the value is ignored and the default applies

### Requirement: Service location entry

The system SHALL let the buyer enter a ZIP, validate it through `/api/serviceability`, and store it in the existing cookie and on the cart (`/api/cart/address`). State and city SHALL be filled from the serviceability table when it has the ZIP.

#### Scenario: Valid ZIP
- **GIVEN** a ZIP present in the serviceability table
- **WHEN** the buyer enters it
- **THEN** state and city are filled, serviceability by technology is shown, and offers are filtered accordingly

#### Scenario: Invalid ZIP
- **GIVEN** a value that is not five digits
- **WHEN** the buyer submits it
- **THEN** the field shows the `INVALID_POSTAL_CODE` message and the stored location is unchanged

#### Scenario: Location not served at all
- **GIVEN** a ZIP that no technology serves
- **WHEN** the buyer enters it
- **THEN** the page states that the location is not served instead of showing an empty catalog

#### Scenario: Location persists across surfaces
- **GIVEN** a stored location
- **WHEN** the buyer opens a category listing, the finder and the bundle
- **THEN** each shows the same location and the same eligibility result

#### Scenario: Clear the location
- **GIVEN** a stored location
- **WHEN** the buyer clears it
- **THEN** the cookie and the cart fields are cleared and the catalogue is not location-gated

### Requirement: Context as explicit API input

`GET /api/offers` and `GET /api/offers/[key]` SHALL resolve the buyer context from the session, and SHALL accept `customerType`, `existingCustomer` and `postalCode` query parameters as the declared context for anonymous callers only. For a signed-in caller the parameters SHALL be ignored.

#### Scenario: Anonymous caller declares
- **WHEN** an anonymous caller requests `GET /api/offers?customerType=employee&existingCustomer=true`
- **THEN** the list is resolved for that declared context

#### Scenario: Signed-in caller cannot override
- **WHEN** a signed-in consumer sends the same request
- **THEN** the list is resolved for the consumer account

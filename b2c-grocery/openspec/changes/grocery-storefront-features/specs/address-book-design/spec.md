## ADDED Requirements

### Requirement: Address list

`/[locale]/account/addresses` SHALL show the customer's addresses as cards in a two-column grid with name, lines, city, postcode, country, a "Default" accent-2 tag on the default shipping address, and actions Edit, Delete and "Make default". An empty state SHALL offer "Add an address".

#### Scenario: Default marked
- **WHEN** the customer has a default shipping address
- **THEN** its card shows the "Default" tag

### Requirement: Add and edit dialog

Adding or editing SHALL open a dialog with labelled fields (first name, last name, street, additional line, postcode, city, country limited to US and DE, phone optional), validate before saving and update via the customer API server-side.

#### Scenario: Save address
- **WHEN** valid data is submitted
- **THEN** the list refreshes with the address

#### Scenario: Invalid postcode
- **WHEN** the postcode does not match the country format
- **THEN** an inline error appears and nothing is saved

### Requirement: Delete and default

Deleting SHALL ask for confirmation in a dialog; deleting the default address SHALL clear the default; "Make default" SHALL set it as default shipping and billing.

#### Scenario: Delete default
- **WHEN** the default address is deleted
- **THEN** no address is marked default

### Requirement: Use in cart

The cart delivery step SHALL offer the customer's saved addresses and an option to add a new one.

#### Scenario: Pick saved address
- **WHEN** a signed-in customer opens the delivery step
- **THEN** saved addresses are selectable and the default is preselected

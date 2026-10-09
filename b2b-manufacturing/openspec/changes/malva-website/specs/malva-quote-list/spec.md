## ADDED Requirements

### Requirement: Quote list holds the services a visitor wants quoted

The system SHALL keep a quote list for each visitor, signed in or not, containing services with an optional frequency and note, and SHALL never display a price, tax or total in it. Design (proposed): `design/malva/specs/cart.md`.

#### Scenario: Persistence
- **GIVEN** a guest added two services
- **WHEN** they reload or return in the same browser session window
- **THEN** both services are still listed and the nav count shows 2

#### Scenario: Merge at sign-in
- **GIVEN** a guest list with two services and a client account whose list has one different service
- **WHEN** the guest signs in
- **THEN** the list shows all three services with no duplicates

### Requirement: Quote list is a zero-priced cart in the default store

The system SHALL implement the quote list as a Cart in the default store, currency USD, single shipping mode, with one line per service. Every service variant carries a price of 0 so that it can be added; the amount is never displayed or totalled, and the priced offer comes later from the Quote.

#### Scenario: Add a service
- **GIVEN** a published service whose variant has the zero price
- **WHEN** it is added to the list
- **THEN** a line item is created with quantity 1, and the page shows no price or total

#### Scenario: Service without the zero price
- **GIVEN** a service variant that has no USD price (a seeding error)
- **WHEN** a visitor adds it
- **THEN** the add fails with a generic message, the failure is logged for the team, and the seed verification reports the service

### Requirement: Edit the list

The system SHALL let the visitor change a line's frequency, edit its note and remove it, updating the page in place.

#### Scenario: Frequency options per service
- **GIVEN** a service that supports Monthly and Quarterly
- **WHEN** the visitor opens its frequency control
- **THEN** only the options that service supports are offered, plus One-off

#### Scenario: Remove last service
- **GIVEN** the list has one service
- **WHEN** the visitor removes it
- **THEN** the empty state "Your quote list is empty. Choose the services you want quoted." appears with links to both listings, and the nav count disappears

#### Scenario: Service no longer available
- **GIVEN** a listed service has been unpublished
- **WHEN** the list renders
- **THEN** that line is flagged "No longer available", is excluded from submission, and can be removed

### Requirement: Continue to the request form

The system SHALL carry the list's contents into the request form without re-entry.

#### Scenario: Continue
- **GIVEN** a list with services
- **WHEN** the visitor chooses **Continue to request**
- **THEN** the form opens at the Site step with the services, frequencies and notes already attached

### Requirement: Quote list is not a purchase

The system SHALL state on the list page that no payment is taken and that Malva replies with a priced quote, and SHALL NOT offer payment, delivery or discount-code controls.

#### Scenario: Copy and controls
- **GIVEN** the list page is shown
- **WHEN** it renders
- **THEN** it includes the sentence "No payment is taken. We reply within one working day with a priced quote." and none of the purchase controls

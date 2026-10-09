## ADDED Requirements

### Requirement: Three-step request form

The system SHALL provide a Request a quote page with a three-step form — Service, Site, Contact — a stepper showing the current and completed steps, Back and Continue controls, and a Submit request button on the last step. Design: `design/malva/specs/checkout.md`.

#### Scenario: Choose what is needed
- **GIVEN** the visitor opens the form with an empty quote list
- **WHEN** step 1 renders
- **THEN** they choose Plumbing, Waste management or Both and may describe the need in free text

#### Scenario: Services from the list
- **GIVEN** the visitor arrives from the quote list or a service page
- **WHEN** the form opens
- **THEN** the chosen services are shown and editable, and the three-way choice is available only as "Not sure yet"

#### Scenario: Going back keeps data
- **GIVEN** the visitor entered data in step 2
- **WHEN** they go back to step 1 and forward again
- **THEN** their entries are still present

### Requirement: Required information and validation

The system SHALL require a service choice (step 1), a company name (step 2), and a name and valid work email (step 3), and SHALL report each problem next to its field in words.

#### Scenario: Missing service
- **GIVEN** no service is chosen
- **WHEN** the visitor continues
- **THEN** "Please choose a service." is shown and the step does not advance

#### Scenario: Invalid email
- **GIVEN** the email lacks a valid address format
- **WHEN** the visitor submits
- **THEN** "Please enter a valid email address." is shown, focus moves to the field, and the message is announced to assistive technology

#### Scenario: Sector and site capture
- **GIVEN** step 2 is shown
- **WHEN** it renders
- **THEN** it offers the sectors Facilities management, Manufacturing, Property / real estate, Healthcare and Other, a site address, and a number-of-sites choice of 1, 2–10, 11–50, 50+

### Requirement: Sector-specific questions

The system SHALL ask for waste types and the site's permit or licence number only when a hazardous-waste, clinical-waste or liquid-waste service is part of the request.

#### Scenario: Clinical waste selected
- **GIVEN** Medical / clinical waste is in the request
- **WHEN** step 2 renders
- **THEN** the optional waste-type and permit fields are shown

#### Scenario: Only plumbing selected
- **GIVEN** the request contains only plumbing services
- **WHEN** step 2 renders
- **THEN** those fields are not shown

### Requirement: An account is required to submit

The system SHALL create every request as a commercetools Quote Request for a signed-in client, because the platform does not allow a Quote Request from an anonymous Cart. A visitor without an account SHALL create one in the last step (open registration; the account is verified automatically in this release, with no email sent), after which the request is submitted in the same action.

#### Scenario: Visitor without an account
- **GIVEN** an anonymous visitor who completed steps 1 and 2
- **WHEN** step 3 renders
- **THEN** it asks for name, job title, work email, phone and a password, states that submitting creates a client account, and links to sign in for existing clients

#### Scenario: Account and request in one action
- **GIVEN** valid step 3 details for an email that has no account
- **WHEN** the visitor submits
- **THEN** a customer, a company (Business Unit) with the visitor as administrator and the Quote Request are created, the visitor is signed in, and the confirmation shows the reference

#### Scenario: Email already has an account
- **GIVEN** the entered email belongs to an existing client
- **WHEN** the visitor submits
- **THEN** nothing is created, and the page asks them to sign in, keeping everything they entered

#### Scenario: Request shape
- **GIVEN** a request is submitted
- **WHEN** the Quote Request is created
- **THEN** its source Cart is a single-shipping Cart in the client's Business Unit, with the site address from step 2 as shipping address, with no discount code, with a zero-priced line per requested service, and the frequency, notes, sector, number of sites and waste details as custom fields

### Requirement: Submission creates exactly one request

The system SHALL record one request per submission, make it visible to the commercial team in the Merchant Center with every captured field, and show a confirmation that includes the requester's name, a reference number and the one-working-day promise. No email is sent in this release.

#### Scenario: Successful submission
- **GIVEN** all steps are valid
- **WHEN** the visitor submits
- **THEN** the form is replaced by "Request received" with a reference, and the request appears in the Merchant Center as a Quote Request in the Submitted state

#### Scenario: Double submit or reload
- **GIVEN** a request was just submitted
- **WHEN** the visitor double-clicks Submit or reloads the confirmation
- **THEN** no second request is recorded

#### Scenario: Delivery failure
- **GIVEN** the request cannot be recorded
- **WHEN** the visitor submits
- **THEN** an error is shown above the buttons, entered data is kept, nothing is reported as received, and no account is left half-created

### Requirement: Signed-in clients

The system SHALL prefill company, site and contact details for a signed-in client and let them choose among their existing sites.

#### Scenario: Prefill
- **GIVEN** a signed-in client with two sites
- **WHEN** step 2 renders
- **THEN** the company is filled, their sites are offered to choose from, and a new site address can be entered instead

#### Scenario: Request appears in the portal
- **GIVEN** a signed-in client submitted a request
- **WHEN** they open Quotes and requests in the portal
- **THEN** the request is listed with its reference and status

#### Scenario: Missing permission
- **GIVEN** a signed-in user whose role does not allow creating quote requests
- **WHEN** they reach the last step
- **THEN** the submit action is replaced by a message naming their company administrator

### Requirement: Consent, abuse protection and contact alternatives

The system SHALL show the data-use notice with a privacy-policy link at the last step, limit automated account creation without relying on a visual challenge, and show alternative contact details (commercial phone, email, hours, emergency line for contracted clients) beside the form.

#### Scenario: Aside content
- **GIVEN** the page is shown
- **WHEN** it renders
- **THEN** the aside card shows the phone number, email address, opening hours and the 24/7 emergency line for contracted clients

#### Scenario: Automated submission
- **GIVEN** a submission fails the abuse checks
- **WHEN** it is posted
- **THEN** it is rejected without a visible challenge for legitimate users, and nothing is delivered to the commercial team

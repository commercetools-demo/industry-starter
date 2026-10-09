## ADDED Requirements

### Requirement: Open registration

The system SHALL let any business create a client account on a registration page, or in the last step of Request a quote, without Malva's approval, collecting company name, sector, the user's name, work email and password. Registration SHALL create the customer, a company (Business Unit) and make the registrant its administrator. In this release the account is verified automatically and no email is sent (owner decision: no email provider); the verification state is kept on the customer so a real verification step can be added later without data migration. This replaces the approval-held registration of the manufacturing specs (`account-registration-request`, `company-account-setup`), which do not apply to Malva.

#### Scenario: Register
- **GIVEN** a visitor on the registration page with valid details
- **WHEN** they submit
- **THEN** a customer (marked verified), a company and an administrator association are created, the visitor is signed in, and they land on the portal overview

#### Scenario: Password rules
- **GIVEN** a password shorter than 10 characters or one of the 1000 most common passwords
- **WHEN** the visitor submits
- **THEN** registration is refused with the rule that failed

#### Scenario: Email already registered
- **GIVEN** an email address that already has an account
- **WHEN** someone registers with it
- **THEN** no account is created and nothing is changed; because no email is sent in this release, the page says an account may already exist and offers sign-in without confirming it (accepted trade-off: enumeration through timing is limited by the rate limit below)

#### Scenario: Abuse
- **GIVEN** repeated registrations from one source or with disposable-looking input
- **WHEN** they exceed the limit
- **THEN** further attempts are rejected with a generic message and no accounts are created

#### Scenario: Join an existing company
- **GIVEN** a company already has an administrator
- **WHEN** a colleague registers with the same email domain
- **THEN** they do not gain access to that company; they get their own company, and the administrator can invite them if wanted

### Requirement: Client sign-in

The system SHALL let verified client users sign in with email and password from a dialog on any page and from a dedicated sign-in page, and SHALL send users to their portal overview afterwards. Design: `design/malva/specs/account.md`.

#### Scenario: Open from anywhere
- **GIVEN** a visitor on any page
- **WHEN** they activate Client portal in the top bar, nav or footer
- **THEN** the sign-in dialog opens with focus on the email field, closes on Escape or backdrop click, and returns focus to the control that opened it

#### Scenario: Wrong credentials
- **GIVEN** an incorrect password
- **WHEN** the user submits
- **THEN** "Email or password is incorrect." is shown without revealing which is wrong

#### Scenario: Return path
- **GIVEN** a user followed a portal link while signed out
- **WHEN** they sign in
- **THEN** they land on the page they asked for

#### Scenario: No account yet
- **GIVEN** the sign-in form is shown
- **WHEN** it renders
- **THEN** it links to registration and to Request a quote

#### Scenario: No password reset
- **GIVEN** the sign-in form and the whole site
- **WHEN** a visitor looks for a way to reset a password
- **THEN** none is offered (owner decision Q-023): no link, page or API route exists; a forgotten password is handled by the Malva team outside the site

### Requirement: Portal is private

The system SHALL require a session for every portal page and document, SHALL show a user only data of companies they belong to, and SHALL NOT cache portal responses in shared caches.

#### Scenario: Signed out
- **GIVEN** no session
- **WHEN** a portal URL is requested
- **THEN** the user is sent to sign-in and no portal data is returned

#### Scenario: Another company's document
- **GIVEN** a user of company A knows the URL of company B's waste transfer note
- **WHEN** they request it
- **THEN** the response is not-found and nothing about the document is disclosed

#### Scenario: Sign out
- **GIVEN** a signed-in user
- **WHEN** they sign out
- **THEN** the session ends and the browser back button does not reveal portal pages

### Requirement: Overview

The system SHALL show on the overview the next scheduled visits, open quote requests, the latest invoice and compliance alerts (for example an expiring certificate or a missed collection).

#### Scenario: New client with no history
- **GIVEN** a client with no visits or invoices
- **WHEN** the overview renders
- **THEN** each block shows a short plain-language empty state and no error

### Requirement: Service visits

The system SHALL list service visits with date (DD/MM/YYYY), site, service, status (Scheduled, In progress, Completed, Missed) and a downloadable report, filterable by site and status.

#### Scenario: Filter by site
- **GIVEN** a client with three sites
- **WHEN** they choose one site
- **THEN** only that site's visits are listed and the URL reproduces the filter

#### Scenario: Missed visit
- **GIVEN** a visit marked Missed
- **WHEN** the list renders
- **THEN** it carries the danger status style and the text "Missed", not colour alone

### Requirement: Waste documents and compliance reporting

The system SHALL list waste transfer and consignment notes and annual waste reports by site, waste type and date, and let users download them.

#### Scenario: Download a note
- **GIVEN** a listed consignment note
- **WHEN** an authorised user chooses Download
- **THEN** the document file is delivered with a name containing the note number and date

#### Scenario: Diversion rate
- **GIVEN** a client with recycling collections
- **WHEN** they open the monthly summary
- **THEN** the diversion rate for the month and the trailing twelve months is shown with the weights it is computed from

### Requirement: Invoices

The system SHALL list invoices with number, date, site, amount, status (Paid, Due, Overdue) and a PDF download, and SHALL NOT take payment online in this release.

#### Scenario: Overdue invoice
- **GIVEN** an overdue invoice
- **WHEN** the list renders
- **THEN** it is marked Overdue in text and style, and the page shows how to contact accounts

### Requirement: Quotes and requests

The system SHALL list the client's quote requests and issued quotes with status, and let an authorised user accept or decline an issued quote or ask a question about it.

#### Scenario: Accept a quote
- **GIVEN** an issued quote
- **WHEN** a user with permission accepts it
- **THEN** the quote shows Accepted, the commercial team is notified, and the action cannot be repeated

#### Scenario: Without permission
- **GIVEN** a user whose role is Finance (read only)
- **WHEN** they view an issued quote
- **THEN** Accept and Decline are not offered

### Requirement: Sites and team

The system SHALL let company administrators view and edit their sites and invite, change the role of, and remove team users (Admin, Site contact, Finance).

#### Scenario: Invite a user
- **GIVEN** a company administrator
- **WHEN** they invite a colleague with the Site contact role for two sites
- **THEN** the colleague can sign in and sees only those sites' data

#### Scenario: Last administrator
- **GIVEN** a company with one administrator
- **WHEN** they try to remove or demote themselves
- **THEN** the action is refused with an explanation

### Requirement: Multiple companies

The system SHALL let a user who belongs to several companies switch between them, and SHALL show only the selected company's data.

#### Scenario: Switch company
- **GIVEN** a user in two companies
- **WHEN** they switch company
- **THEN** every list and the overview reflect the new company and previously loaded data of the other company is not shown

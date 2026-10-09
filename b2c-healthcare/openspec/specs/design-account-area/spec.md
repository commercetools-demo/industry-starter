<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Account area design: sign-in, overview, labs, appointments, orders

## Purpose

The account area is where a patient's health data lives: lab results with reference ranges, appointments and medication orders. It is the most sensitive surface in the storefront, so every view must be scoped to the signed-in patient and shown in the states the prototype skips (loading, error, nothing yet). The prototype's sign-in accepts any credentials; the design is kept, the behavior is not.

Design reference: `design/DESIGN.md`; source `design/source/app-account.jsx`, `app-core.jsx` (`Login`). Behavioral base: `account-sign-in`, `account-dashboard`, `order-history`, `post-purchase-order-management`, `health-data-minimization`.

## Requirements

### Requirement: Sign-in and create account card

The system SHALL show a centered 440px card with the title "Sign in to Malva" or "Create your account", an optional reason line, the fields and a toggle between the two modes.

#### Scenario: Sign in
- **GIVEN** the card in sign-in mode
- **WHEN** it renders
- **THEN** it shows Email, Password, a full-width "Sign in" button and "New to Malva? Create an account"

#### Scenario: Create account
- **GIVEN** create mode
- **WHEN** it renders
- **THEN** a Full name field is added, the button reads "Create account" and the toggle reads "Have an account? Sign in"

#### Scenario: Return to where the patient was going
- **GIVEN** the card opened because of a protected route
- **WHEN** authentication succeeds
- **THEN** the patient lands on that route (default `/account`); an already signed-in patient opening `/login` is redirected to `/account`

#### Scenario: Wrong credentials
- **GIVEN** invalid credentials
- **WHEN** the form is submitted
- **THEN** a single inline error is shown without saying which field was wrong; the prototype's "any email and password will sign you in" demo note and prefilled values are not shipped

#### Scenario: Registration and reset
- **GIVEN** the card
- **WHEN** it ships
- **THEN** email verification and password reset links follow `email-verification` and `password-reset` (not designed)

### Requirement: Account layout and navigation

The system SHALL render account pages with a 240px side navigation (Overview, Lab tests, Appointments, Orders; active item azure fill) and a "Sign out" outline button, content on the right; under 900px they stack.

#### Scenario: Sign out
- **GIVEN** a signed-in patient
- **WHEN** they activate "Sign out"
- **THEN** the session ends, cached account data is cleared, and they go to `/login`

### Requirement: Overview

The system SHALL greet the patient and show summary tiles and the latest lab results.

#### Scenario: Overview content
- **GIVEN** a signed-in patient
- **WHEN** `/account` renders
- **THEN** it shows "Hello, <first name>", the email, three tiles (Lab results ready, Appointments, Orders — each a link to its list) and a "Latest lab results" card with the three most recent tests

#### Scenario: Zero states
- **GIVEN** a patient with nothing yet
- **WHEN** the overview renders
- **THEN** tiles show 0 and the lab card says there are no results yet instead of rendering empty

### Requirement: Lab tests

The system SHALL list lab tests and show a test's results with reference ranges.

#### Scenario: List
- **GIVEN** `/account/labs`
- **WHEN** it renders
- **THEN** each row shows the test name, "<date> · <laboratory>", a badge ("Results ready" green or "Processing" amber) and "→"; the row is a link to `/account/labs/:id`; `/labs` redirects here

#### Scenario: Detail header
- **GIVEN** `/account/labs/:id`
- **WHEN** it renders
- **THEN** "← All lab tests", the test name with status badge, rows Collected, Ordered by, Laboratory and a note card with the clinician's comment

#### Scenario: Result table
- **GIVEN** a test with results
- **WHEN** the table renders
- **THEN** columns Test, Result (value + unit), Reference range (8px bar with a marker positioned within 4–96% and the range text, "< N" when the lower bound is 0) and a flag badge: Normal (green), High or Low (red, with the bar track in danger-50); the flag is also available as text, not by color alone

#### Scenario: Processing test
- **GIVEN** a test whose status is processing
- **WHEN** the detail renders
- **THEN** only the header and note card show, with no table and no actions

#### Scenario: Actions
- **GIVEN** a test with results
- **WHEN** the detail renders
- **THEN** "Download PDF" delivers a PDF of the results and "Discuss with a doctor" opens the doctor list for the test's ordering doctor (the prototype links to the generic list)

#### Scenario: Unknown or foreign test
- **GIVEN** an id that is not the patient's
- **WHEN** it is opened
- **THEN** "Not found." is shown, identical for nonexistent ids

### Requirement: Appointments

The system SHALL list the patient's bookings.

#### Scenario: List
- **GIVEN** bookings
- **WHEN** `/account/appointments` renders
- **THEN** each card shows doctor name, "<date> at <time> · Video session | <clinic>" and the reference badge, upcoming first; past visits are separated

#### Scenario: Empty
- **GIVEN** no bookings
- **WHEN** the page renders
- **THEN** "No appointments yet. Book one" links to `/doctors/remote`

#### Scenario: Cancel or reschedule
- **GIVEN** an upcoming booking
- **WHEN** the page renders
- **THEN** cancel/reschedule are offered per clinic policy (not designed)

### Requirement: Orders

The system SHALL list the patient's medication orders.

#### Scenario: List
- **GIVEN** orders
- **WHEN** `/account/orders` renders
- **THEN** each card shows order number, the item names, total and a "Track" outline button to `/order/:id`, newest first

#### Scenario: Empty
- **GIVEN** no orders
- **WHEN** the page renders
- **THEN** "No orders yet. Order from a prescription" links to `/prescriptions`

### Requirement: Account data is scoped, minimized and not cached

The system SHALL return account data only for the signed-in patient and SHALL NOT cache or log lab values.

#### Scenario: Cross-patient access
- **GIVEN** a patient requesting another patient's lab, order or booking id
- **WHEN** the request is made
- **THEN** the response is indistinguishable from "not found"

#### Scenario: Caching
- **GIVEN** any account route
- **WHEN** it is served
- **THEN** it is marked non-cacheable and lab values never appear in URLs, analytics events or error reports (`health-data-minimization`)

## Components

| Component | Data source |
| --- | --- |
| Sign-in card | auth |
| Side nav | static |
| Overview tiles, lists | middleware, per patient |
| Lab detail, range bar | middleware, per patient (external lab source) |

## commercetools

Entities: `Customer` (identity, email), `Order` (order list, tracking), bookings per D1. Lab results are not commercetools resources; they come from the lab/EHR source and are referenced by an id, never stored on the Customer. Orders are read for the signed-in customer only.

## commercetools skills

Load `commercetools-storefront` before implementing. Supporting: `commercetools-platform`.

## Open questions

- Which system is the source of lab results and how does a patient's identity map to it?
- Are lab reference ranges per patient (age/sex) or fixed per test as in the prototype?
- Profile, addresses, payment methods, notifications, family accounts are not designed (`address-book`, `payment-methods`).

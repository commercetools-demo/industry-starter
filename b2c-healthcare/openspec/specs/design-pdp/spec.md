<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Doctor profile and booking design

## Purpose

The product detail page is a doctor's profile with a booking panel: choose video or in-office, a day, a time, then confirm. Booking is deliberately open to guests with no payment step ("pay at the visit"), which makes two things easy to get wrong: double-booking the same slot, and collecting health information from someone with no account.

Design reference: `design/DESIGN.md`; source `design/source/app-doctors.jsx` (`DoctorDetail`, `BookModal`, `Booked`). Behavioral base: `product-detail-page`, `credentialed-purchase-scope`.

## Requirements

### Requirement: Doctor profile layout

The system SHALL render `/doctor/:id` as a breadcrumb "← All doctors", a two-column layout (content left, 380px sticky booking panel right), and SHALL show a not-found message with a link back to search for an unknown doctor.

#### Scenario: Profile content
- **GIVEN** a doctor
- **WHEN** the profile renders
- **THEN** the left column shows a header card (104px avatar, H1 name, specialty, badges "★ rating · N reviews" and "N yrs experience"), an About card (bio; Education, Languages, Clinic rows) and a Patient reviews card

#### Scenario: Reviews
- **GIVEN** the reviews card
- **WHEN** it renders
- **THEN** each review shows quote text and "Verified patient · Mon YYYY"; only reviews from verified patients appear, and the card is omitted when there are none (the prototype's two reviews are fixtures)

#### Scenario: Back link keeps context
- **GIVEN** the visitor arrived from the list with filters
- **WHEN** they use "← All doctors"
- **THEN** they return to the list in the same mode with the same filters

#### Scenario: Unknown doctor
- **GIVEN** an id that does not exist
- **WHEN** the page requests it
- **THEN** "Doctor not found. Back to search" is shown with an HTTP 404

### Requirement: Booking panel

The system SHALL let the visitor pick a mode, a day within the next seven days and a free time, and SHALL show the fee for the chosen mode.

#### Scenario: Mode toggle
- **GIVEN** the panel opened with the mode from the list (`?m=remote|office`)
- **WHEN** the visitor toggles "Video" / "In office"
- **THEN** the fee in the panel header updates; modes the doctor does not offer are disabled

#### Scenario: Day and slots
- **GIVEN** a 7-column day picker (weekday + date)
- **WHEN** a day is selected
- **THEN** it takes the navy selected style, the full date line is shown, and that day's free times appear in a 3-column grid

#### Scenario: Day with no free time
- **GIVEN** a day with no free slot
- **WHEN** it is selected
- **THEN** a note reads "No times left on this day. Try another date."

#### Scenario: Who is booking
- **GIVEN** the panel footer
- **WHEN** the visitor is signed in
- **THEN** it reads "Booking as <name>"; when anonymous, "No account needed. You can book as a guest."

### Requirement: Confirm booking modal

The system SHALL open a modal on slot selection summarizing the booking and collecting the contact details needed to confirm it.

#### Scenario: Guest
- **GIVEN** an anonymous visitor selecting 09:30 on a day
- **WHEN** the modal opens
- **THEN** it shows the summary note (doctor, mode, date, time, fee), "Booking as a guest. Sign in instead", and fields Full name, Email, Phone and Reason for visit (all required) with "Confirm booking"

#### Scenario: Signed-in patient
- **GIVEN** a signed-in patient
- **WHEN** the modal opens
- **THEN** name and email are shown as text ("Booking as <name> (<email>)"), and only Phone and Reason are asked

#### Scenario: Close
- **GIVEN** the open modal
- **WHEN** the visitor clicks the overlay, activates Close or presses Escape
- **THEN** it closes and focus returns to the slot; focus is trapped while open (the prototype lacks Escape and trapping)

#### Scenario: Slot taken meanwhile
- **GIVEN** another booking took the slot after the panel loaded
- **WHEN** the visitor confirms
- **THEN** the booking is rejected, the modal shows that the time is no longer available, and the slot grid refreshes

#### Scenario: Health data minimization
- **GIVEN** the free-text reason for visit
- **WHEN** the modal renders and the booking is stored
- **THEN** it carries a short consent/retention line and the text is handled per `health-data-minimization` (not placed in analytics, logs or order notes)

### Requirement: Booking confirmation page

The system SHALL redirect to `/booked/:id` after a successful booking and show the reference, details and next steps.

#### Scenario: Confirmation content
- **GIVEN** a confirmed booking
- **WHEN** `/booked/:id` renders
- **THEN** a green "Booking confirmed" badge, H1 "You're booked, <first name>.", "A confirmation was sent to <email>." and rows Reference, Doctor (name · specialty), When, Type, Join (video: "A secure video link will arrive by email 15 minutes before.") or Where (office: clinic), and Fee "$N · pay at the visit"

#### Scenario: Guest nudge
- **GIVEN** a guest booking
- **WHEN** the page renders
- **THEN** a note offers "Create an account" to manage appointments and see prescriptions and lab results; signed-in patients instead get "My appointments"

#### Scenario: Access to a booking
- **GIVEN** a booking reference
- **WHEN** a different visitor opens `/booked/:id`
- **THEN** it does not show the booking; guest bookings are viewable only in the booking's own session or via a signed link from the confirmation email

## Components

| Component | Data source |
| --- | --- |
| Profile header, About, Reviews | cached product data + reviews |
| Booking panel (days, slots) | middleware, uncached |
| Booking modal, confirmation | middleware, per request |

## commercetools

Entities: `Product`/`ProductVariant` (doctor offering; prices per mode), `Review`, and for the booking an `Order`-like record or `Custom Object` (decision D1). Slot availability and double-booking prevention belong to the scheduling source; commercetools holds the catalog and, if used, the fee. Guest bookings are not tied to a `Customer` until the visitor creates an account, at which point the booking is attached by email-verified match.

## commercetools skills

Load `commercetools-storefront`. Supporting: `commercetools-platform`.

## Open questions

- D1: is a booking a commercetools Order (zero-payment) or an external appointment record?
- D5/D6: "pay at the visit" and guest health data.
- Can a doctor offer only one mode? The prototype assumes both for every doctor.

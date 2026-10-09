<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Listing pages design: doctor list and prescription lookup

## Purpose

Malva has two listing surfaces. The doctor list is a filterable catalog of bookable clinicians in two modes (remote, office) with fee and next availability on every card. The prescription lookup is not a catalog at all: it lists only the medications on one prescription, found by RX number. The danger in the second is treating a prescription number as a search term and leaking another patient's medications.

Design reference: `design/DESIGN.md`; source `design/source/app-doctors.jsx` (`Doctors`), `app-rx.jsx` (`Prescriptions`), `app.css`. Behavioral base: `product-listing-page`, `search-results-page`, `prescription-bound-supply`.

## Requirements

### Requirement: Doctor list by consultation mode

The system SHALL list doctors at `/doctors/remote` and `/doctors/office`, with a page head (H1 "Remote sessions" or "Office visits", mode-specific sub), a segmented control to switch mode, and a count line "N doctor(s)".

#### Scenario: Switching mode
- **GIVEN** the doctor list in remote mode
- **WHEN** the visitor selects "Office visit"
- **THEN** the route changes to `/doctors/office`, the fee on each card becomes the office fee, the clinic appears in the meta line, and the city filter appears

#### Scenario: Filters
- **GIVEN** the filter bar (search by name or specialty, specialty select, city select in office mode only, "Available today" checkbox)
- **WHEN** the visitor sets any combination
- **THEN** the list shows only matching doctors, the count updates, and the filter state is held in the URL so the page can be shared and the back button restores it

#### Scenario: No match
- **GIVEN** filters that match no doctor
- **WHEN** the list renders
- **THEN** a card reads "No doctors match. Try clearing a filter."

#### Scenario: Available today
- **GIVEN** the "Available today" filter
- **WHEN** it is on
- **THEN** only doctors whose next free slot is today remain, using the same availability the cards show

### Requirement: Doctor card content

The system SHALL render each doctor as a card showing avatar, name, specialty and experience, rating, fee for the current mode and availability, and SHALL navigate to the profile when the card is activated.

#### Scenario: Card anatomy
- **GIVEN** a doctor
- **WHEN** the card renders
- **THEN** it shows a 56px peach avatar with initials (or photo), the name in brand-700, "Specialty · N yrs experience", "★ rating (N reviews)" (plus " · clinic" in office mode), a right column with an availability badge, the fee (navy bold) and a "View profile" button

#### Scenario: Availability badge
- **GIVEN** the doctor's next free slot
- **WHEN** it is today
- **THEN** the badge is green "Available today"; when it is later in the 7-day window the badge is blue "Next: Tue 14"; when there is none no badge is shown

#### Scenario: Navigation and keyboard
- **GIVEN** a card
- **WHEN** it is clicked or activated by keyboard
- **THEN** the visitor goes to `/doctor/:id?m=<mode>`; the card is a real link (the prototype's clickable `div` is not keyboard reachable)

#### Scenario: Narrow screens
- **GIVEN** a viewport under 900px
- **WHEN** the card renders
- **THEN** the right column drops under the text spanning the full width

### Requirement: Doctor list pagination

The system SHALL page or lazy-load the doctor list rather than rendering every doctor.

#### Scenario: More doctors than a page
- **GIVEN** more doctors than the page size
- **WHEN** the list renders
- **THEN** the first page loads with a pagination control (design-system `pagination` component), and the count line shows the total

### Requirement: Prescription lookup by RX number

The system SHALL let a signed-in patient find a prescription by RX number and show the medications on it, and SHALL NOT reveal whether an RX number that belongs to someone else exists.

#### Scenario: Lookup
- **GIVEN** a signed-in patient on `/prescriptions`
- **WHEN** they enter `RX-48213` (also accepted: `rx 48213`, `RX48213`) and submit
- **THEN** a card shows the RX number, "Prescribed by <doctor> · <date>", badges "Patient: <name>" and "N refills left", a select-all checkbox, one row per medication (checkbox, name, sig, "Qty N", price), "N selected · $total" and an "Add to cart" button

#### Scenario: Unknown or foreign RX
- **GIVEN** an RX number that does not exist or belongs to a different patient
- **WHEN** it is submitted
- **THEN** the same message appears for both: "We couldn't find “<input>”. Check the number printed on your prescription." and the attempt is rate limited

#### Scenario: Before searching
- **GIVEN** no search yet
- **WHEN** the page renders
- **THEN** a muted card reads "Your medications will appear here after you search."

#### Scenario: Selection
- **GIVEN** a found prescription with all medications selected
- **WHEN** the patient unchecks some
- **THEN** "N selected" and the total update, select-all reflects the state, and "Add to cart" is disabled when none are selected

#### Scenario: Add to cart
- **GIVEN** selected medications
- **WHEN** "Add to cart" is activated
- **THEN** the lines are added (replacing a line already in the cart from the same prescription and medication) and a toast "Added to cart · View cart →" shows for 5 seconds

#### Scenario: Medication that cannot be dispensed
- **GIVEN** a medication with no refills left, expired, out of stock or over its dispensing limit
- **WHEN** the row renders
- **THEN** it is shown with a reason and cannot be selected (rules in `prescription-bound-supply`, `dispensing-quantity-limit`, `expiry-dated-supply`); the prototype has no such state

#### Scenario: Quick-pick badges
- **GIVEN** the prototype's "Try: RX-48213 RX-77102" demo badges
- **WHEN** the page ships
- **THEN** they are not shown; a patient's own prescriptions may be listed instead

## Components

| Component | Notes |
| --- | --- |
| Page head with segmented control | static |
| Filter bar | URL state |
| Doctor card | listing data + availability (middleware) |
| Pagination | design-system `pagination` |
| RX search + result card, medication row | middleware, per patient |
| Toast | client |

## commercetools

Entities: doctors as `Product`/`ProductProjection` (service offerings with attributes specialty, years, rating, languages, clinic, city, fee per mode) searched with the Product Search API; medications as `Product` with `Rx` binding; prescription as a `Custom Object` or external record keyed by RX number. Consultation fee per mode is either two prices on one SKU/variant or two variants (decision D1). Facet and filter state lives in the URL; "Available today" is not a catalog facet and must come from the scheduling source.

## commercetools skills

Load `commercetools-storefront` before implementing. Supporting: `commercetools-platform`, `commercetools-commerce-patterns`.

## Open questions

- Is "rating" and "N reviews" from `Review` objects or an external source?
- Distance/"near you" is promised in copy ("clinic near you") but only a city filter exists.
- Sort order is not designed; default to soonest availability?

<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Home page design

## Purpose

The home page explains what Malva offers (video and office visits, prescriptions delivered, lab results) and routes a visitor into the doctor list or prescription lookup within one click. Its numbers, availability claims and doctor cards are the part most likely to be hard-coded and then be wrong, so each must come from live data or be omitted.

Design reference: `design/DESIGN.md`; source `design/source/Malva Healthcare.html`. Behavioral base: `home-landing-page`.

## Requirements

### Requirement: Home page sections in design order

The system SHALL render, in order: hero, services grid, how-it-works steps, doctors available today, prescription delivery, statistics band, health journal, closing CTA, footer.

#### Scenario: Hero
- **GIVEN** the home page
- **WHEN** it renders
- **THEN** a `--gradient-sky` hero shows H1 "Care that comes to you, or the other way round.", a lead paragraph, a search field "Doctor, specialty or medicine" with a Search button, four specialty chips (General practice, Dermatology, Mental health, Pediatrics) and a right-hand 460px image area with rounded top corners

#### Scenario: Search submit
- **GIVEN** text in the hero search
- **WHEN** the visitor submits
- **THEN** they reach search results for that text (the prototype's form does nothing; decision D11), and a chip leads to the doctor list filtered to that specialty

#### Scenario: Services grid
- **GIVEN** the services section
- **WHEN** it renders
- **THEN** a grid (auto-fit, min 250px) shows service cards, each with a 52px icon tile, title, one-line description and a link, for services that exist: Remote sessions → `/doctors/remote`, Office visits → `/doctors/office`, Prescriptions and Medicine delivery → `/prescriptions`, Lab tests → `/account/labs`, Health records → `/account`; cards whose destination is not designed (Mental health, Second opinion) are omitted until designed (D13)

#### Scenario: How it works
- **GIVEN** the steps section
- **WHEN** it renders
- **THEN** four numbered steps (44px navy circles) read "Tell us what's wrong", "Choose your doctor", "Meet by video or in person", "Get your care plan"

### Requirement: Doctors available today from live availability

The system SHALL show up to three doctor cards in the "Doctors available today" section, chosen from doctors who actually have a free slot today, and SHALL link each to the doctor profile.

#### Scenario: Doctors available
- **GIVEN** at least one doctor with a bookable slot today
- **WHEN** the section renders
- **THEN** each card shows peach avatar, name, specialty and years, rating and review count, an "Available today" badge, the lead fee with its mode ("Video · $35") and a "Book" button to `/doctor/:id`

#### Scenario: No availability today
- **GIVEN** no doctor has a slot today
- **WHEN** the section renders
- **THEN** the section shows doctors with their next available day instead of the "Available today" badge, or is hidden; it never shows a fixed list

### Requirement: Statistics and live claims are sourced

The system SHALL show the statistics band and the hero's floating chips only from measured data.

#### Scenario: Statistics band
- **GIVEN** the band (2M+ consultations, 8,000 verified doctors, 15 min median wait, 4.8/5 rating)
- **WHEN** it renders
- **THEN** each figure comes from a maintained source, and a figure without a source is removed rather than shown as a literal

#### Scenario: Floating chips
- **GIVEN** the hero chips "12 doctors available now" and "Rx #… out for delivery"
- **WHEN** they render
- **THEN** the doctor count is the live count of doctors available now, and the delivery chip is removed (it would expose another patient's order)

### Requirement: Prescription delivery and journal blocks

The system SHALL show a prescription-delivery block with a checklist and two calls to action, and a health-journal row of three article cards.

#### Scenario: Prescription block
- **GIVEN** the block
- **WHEN** it renders
- **THEN** it shows the heading "Your prescription, delivered", three check items (same-day delivery in most cities, auto-refills pausable anytime, pharmacist chat), "Order medicine" and "Find by RX number", both to `/prescriptions`; claims the service cannot honor (auto-refills, same-day) are only shown when the capability exists

#### Scenario: Journal
- **GIVEN** the journal block
- **WHEN** it renders
- **THEN** three cards show a 180px image area, "Category · N min read" and the title, each linking to its article (see `blog-resources`); the block is omitted while no articles exist

### Requirement: Closing call to action

The system SHALL end the page with a gradient CTA band "Feeling unwell? See a doctor today." and a "Book a visit" button, and the band SHALL not imply emergency care.

#### Scenario: Emergency disclaimer
- **GIVEN** the home page
- **WHEN** the footer renders
- **THEN** "Not for emergencies — call your local emergency number." is visible without scrolling horizontally on any width

## Components

| Component | Data source |
| --- | --- |
| Hero copy, specialty chips, services, steps, prescription block, CTA | static |
| Search | middleware (query) |
| Doctors available today | middleware (availability is time-sensitive; short-cache at most) |
| Statistics band | cached |
| Journal cards | cached |
| Header/footer | see `design-storefront-shell` |

## commercetools

Entities: `Product`/`ProductProjection` (doctors as bookable offerings), `Category`, `Cart`. Availability is not a commercetools concept; it comes from the scheduling source (decision D1).

## commercetools skills

Load `commercetools-storefront`. Supporting: `commercetools-platform`.

## Open questions

- What system owns slots/availability, and how fresh must "available today" be?
- Which statistics are real and who maintains them?

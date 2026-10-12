<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Portal demo login

## Purpose

On the sign-in page of a demo environment, a person can pick one of the seeded demo accounts (business-unit associates) from a dropdown and sign in with one button, without knowing the email or password. It replaces the single "Use demo credentials" button of `seller-portal/design-auth-screens`.

Design source: none. The control is added to the sign-in card of `Malva Seller Portal.dc.html` (auth overlay `login`). Owner request, 2026-10-12.

## Requirements

### Requirement: Demo account picker on the sign-in card

The system SHALL show, below the email and password form and above the secondary link row, a labelled dropdown "Demo account" and a button "Sign in as demo user", only when demo login is enabled.

Each dropdown option SHALL read "{name} · {role} · {business unit}" (for example "Nora Admin · Admin · Küstenwerk Nord"), grouped by business unit, ordered by business unit then role (Admin before Buyer).

#### Scenario: Picker visible in a demo environment
- **GIVEN** demo login is enabled and the project holds seeded demo associates
- **WHEN** the sign-in card renders
- **THEN** the dropdown lists every seeded demo associate, grouped by business unit, and the button is disabled until one is selected

#### Scenario: Demo login disabled
- **GIVEN** demo login is not enabled
- **WHEN** the sign-in card renders
- **THEN** neither the dropdown nor the button is in the page, and the demo-accounts route answers 404

#### Scenario: No demo accounts
- **GIVEN** demo login is enabled but the project holds no demo associates
- **WHEN** the card renders
- **THEN** the dropdown is replaced by the text "No demo accounts found. Run the seed." and the button is absent

### Requirement: Demo login uses the normal sign-in

The system SHALL sign the selected associate in through the same server sign-in as the email and password form, creating the same session, so that role-based navigation, business-unit context and every permission behave exactly as for a real sign-in.

The browser SHALL send only the identifier of the chosen demo account. The demo password SHALL be held on the server (environment variable) and SHALL never be sent to the browser or listed in any response.

#### Scenario: Sign in as an Admin
- **GIVEN** "Nora Admin · Admin · Küstenwerk Nord" is selected
- **WHEN** "Sign in as demo user" is pressed
- **THEN** the portal opens on the dashboard of that business unit with Admin navigation

#### Scenario: Sign in as a Buyer
- **GIVEN** a Buyer is selected
- **WHEN** the button is pressed
- **THEN** the navigation shows only what a Buyer may see

#### Scenario: Password never exposed
- **GIVEN** the demo picker on screen
- **WHEN** the page source, the accounts response and the sign-in request are inspected
- **THEN** none of them contains the demo password

### Requirement: Only seeded demo accounts, only in non-production

The system SHALL list only associates that the seed marked as demo accounts, never real or self-registered users, and SHALL refuse the demo sign-in route for any identifier that is not in that list.

Demo login SHALL be enabled only by an explicit setting (`DEMO_LOGIN_ENABLED=true`) and SHALL be impossible in a production build: a build check SHALL fail when the setting is on and the environment is production.

#### Scenario: Unlisted account
- **GIVEN** a request to the demo sign-in route with the id of a real associate
- **WHEN** it is handled
- **THEN** it answers 403, creates no session and logs a denial

#### Scenario: Production build
- **GIVEN** `DEMO_LOGIN_ENABLED=true` in a production build
- **WHEN** the build checks run
- **THEN** the build fails with a message naming the setting

### Requirement: States and accessibility

The system SHALL show a loading state while accounts load, an inline error ("Demo sign-in failed. Try again.") when the sign-in fails, and SHALL keep the dropdown and button keyboard operable with a visible focus ring, a programmatic label and the error announced to assistive technology.

#### Scenario: Failure
- **GIVEN** the demo password in the environment no longer matches the account
- **WHEN** the button is pressed
- **THEN** the inline error shows, the card stays, and no password or account detail is revealed

## Gaps

- The design has no demo picker; spacing follows the card layout (44 px field, 48 px button) and uses admin-kit tokens only.
- Associates carry no display name field beyond the customer name; the label is built from customer name, role key and business-unit name.

## Platform notes

Reads the seeded associates server-side with the admin client, filtered by a demo marker on the customer (seed request: `malva-customer.isDemo`). Signs in through the as-associate flow of `commercetools-storefront`; load that skill before building. Workstream R builds it; seed support is in `plans/notes/seed-requests.md`.

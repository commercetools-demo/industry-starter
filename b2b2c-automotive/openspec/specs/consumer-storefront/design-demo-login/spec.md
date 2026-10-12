<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Storefront demo login

## Purpose

On the sign-in page of a demo environment, a person can pick one of the seeded demo shoppers from a dropdown and sign in with one button, without knowing an email or password. The list shows the shoppers of the reseller store the visitor is on.

Design source: none. The control is added to the storefront sign-in page (`/[locale]/[store]/account/sign-in`). Owner request, 2026-10-12.

## Requirements

### Requirement: Demo shopper picker on the sign-in page

The system SHALL show, below the email and password form, a labelled dropdown "Demo account" and a button "Sign in as demo shopper", only when demo login is enabled.

Each option SHALL read "{name} · {vehicle}" when the shopper has a saved vehicle (for example "Anna Schneider · Volkswagen Golf 2019") and "{name}" otherwise. Only shoppers belonging to the current store SHALL be listed.

#### Scenario: Picker visible in a demo environment
- **GIVEN** demo login is enabled and the current store has seeded demo shoppers
- **WHEN** the sign-in page renders
- **THEN** the dropdown lists exactly those shoppers and the button is disabled until one is selected

#### Scenario: Other store
- **GIVEN** the visitor is on store A
- **WHEN** the dropdown renders
- **THEN** shoppers seeded for store B are not listed

#### Scenario: Demo login disabled
- **GIVEN** demo login is not enabled
- **WHEN** the page renders
- **THEN** neither the dropdown nor the button is in the page, and the demo-accounts route answers 404

#### Scenario: No demo shoppers
- **GIVEN** demo login is enabled but the store has no demo shoppers
- **WHEN** the page renders
- **THEN** the dropdown is replaced by "No demo accounts found. Run the seed." and the button is absent

### Requirement: Demo login uses the normal sign-in

The system SHALL sign the selected shopper in through the same server sign-in as the email and password form, including the merge of the anonymous cart and the anonymous garage, so the session, cart, garage and account area behave exactly as for a real sign-in. After sign-in the shopper SHALL be returned to the page they came from, or the account overview.

The browser SHALL send only the identifier of the chosen demo account. The demo password SHALL be held on the server (environment variable) and SHALL never be sent to the browser or listed in any response.

#### Scenario: Sign in with a saved vehicle
- **GIVEN** a demo shopper with a saved vehicle and an anonymous visitor with items in the cart
- **WHEN** the shopper is selected and the button pressed
- **THEN** the cart keeps the items, the garage shows the saved vehicle as active and the fit badges use it

#### Scenario: Password never exposed
- **GIVEN** the demo picker on screen
- **WHEN** the page source, the accounts response and the sign-in request are inspected
- **THEN** none of them contains the demo password

### Requirement: Only seeded demo shoppers, only in non-production

The system SHALL list only customers that the seed marked as demo accounts, never real or self-registered shoppers, and SHALL refuse the demo sign-in route for any identifier that is not in that list.

Demo login SHALL be enabled only by an explicit setting (`DEMO_LOGIN_ENABLED=true`) and SHALL be impossible in a production build: a build check SHALL fail when the setting is on and the environment is production.

#### Scenario: Unlisted account
- **GIVEN** a request to the demo sign-in route with the id of a real customer
- **WHEN** it is handled
- **THEN** it answers 403, creates no session and logs a denial

#### Scenario: Production build
- **GIVEN** `DEMO_LOGIN_ENABLED=true` in a production build
- **WHEN** the build checks run
- **THEN** the build fails with a message naming the setting

### Requirement: Styling, localisation and accessibility

The system SHALL render the control with theme tokens only (so it follows the reseller theme), with labels in `de-DE` and `en-US` message files, a loading state while accounts load, an inline error ("Demo sign-in failed. Try again.") on failure, and SHALL keep the dropdown and button keyboard operable with a visible focus ring, a programmatic label and the error announced to assistive technology.

#### Scenario: German locale
- **GIVEN** the page in `de-DE`
- **WHEN** the control renders
- **THEN** its label, button, empty state and error come from the German message file

#### Scenario: Failure
- **GIVEN** the demo password in the environment no longer matches the account
- **WHEN** the button is pressed
- **THEN** the inline error shows and no password or account detail is revealed

## Gaps

- The design has no sign-in page for the storefront at all (see `consumer-storefront/design-account-area`); the layout follows that page once designed.

## Platform notes

Reads the seeded customers server-side with the admin client, filtered by a demo marker (seed request: `malva-customer.isDemo`) and the customer's store. Signs in through the store-scoped customer login of `commercetools-storefront`; load that skill before building. Workstream Q builds it on the auth routes from workstream N; seed support is in `plans/notes/seed-requests.md`.

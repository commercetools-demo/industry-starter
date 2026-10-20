## ADDED Requirements

### Requirement: Intake entry in the header for signed-in clients only
The top bar and the mobile menu SHALL show an Intake link beside Client portal and Request quote only when a client is signed in. It SHALL navigate to `/account/intake` in the current locale.

#### Scenario: Signed in
- **WHEN** a signed-in client views any page
- **THEN** the Intake link is present and leads to the Intake page

#### Scenario: Signed out
- **WHEN** a visitor is not signed in
- **THEN** no Intake link is rendered in either the top bar or the mobile menu

### Requirement: Intake page lives in the portal
The route `/account/intake` SHALL sit in the portal area, with the portal's sign-in redirect and navigation, and SHALL be excluded from search indexing.

#### Scenario: Signed-out visit
- **WHEN** a visitor opens `/account/intake` without a session
- **THEN** they are sent to sign-in and returned to the page afterwards

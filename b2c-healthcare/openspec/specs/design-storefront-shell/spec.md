<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Storefront shell: navigation, session slots and footer

## Purpose

Every page shares one header and footer. The header mixes content that is identical for all visitors (links, logo) with state that belongs to one patient (cart count, signed-in identity). The prototype renders both from client storage; in the storefront the per-patient parts must come from the session and must never be baked into shared, cached markup.

Design reference: `design/DESIGN.md` (Top nav, Marketing nav, Footer); source `design/source/app-core.jsx` (`Nav`, `Foot`), `Malva Healthcare.html`.

## Requirements

### Requirement: Header navigation

The system SHALL render a sticky 72px header with the Malva logo, the primary links Remote sessions, Office visits, Prescriptions and Lab tests, a Cart button and an account slot, and SHALL mark the link of the current section active.

#### Scenario: Active section
- **GIVEN** the current route is `/doctors/remote`, `/doctors/office`, `/prescriptions` (also `/cart`, `/checkout`, `/order/*`) or `/account/labs`
- **WHEN** the header renders
- **THEN** the matching link shows the active style (brand-600 text, 2px brand underline) and the others do not

#### Scenario: Anonymous visitor
- **GIVEN** no session
- **WHEN** the header renders
- **THEN** the account slot shows a "Sign in" button and the cart shows no count

#### Scenario: Signed-in patient
- **GIVEN** a session
- **WHEN** the header renders
- **THEN** the account slot shows a 36px avatar with the patient's initials linking to the account, and the cart button shows a count bubble when the cart has items

#### Scenario: Home header variant
- **GIVEN** the home page
- **WHEN** the header renders
- **THEN** it adds Home and a Health journal link, shows "Sign in" (outline) and "Book a visit" (primary) instead of the cart/avatar pair, and links into the app routes

#### Scenario: Narrow screens
- **GIVEN** a viewport under 900px
- **WHEN** the header renders
- **THEN** the primary links collapse into a menu (the prototype hides them with no replacement) and the logo stays left (decision D10)

### Requirement: Session-resolved header state

The system SHALL resolve cart count and signed-in identity from the current session on each request and SHALL NOT include them in markup cached and shared between visitors.

#### Scenario: Expired session
- **GIVEN** a session whose token has expired
- **WHEN** any page renders
- **THEN** the header renders as for an anonymous visitor and no stale count or initials appear

### Requirement: Footer

The system SHALL render a navy footer with the emergency disclaimer on every page.

#### Scenario: App footer
- **GIVEN** any app page
- **WHEN** the footer renders
- **THEN** it shows "© 2026 Malva Healthcare" and "Not for emergencies — call your local emergency number."

#### Scenario: Home footer
- **GIVEN** the home page
- **WHEN** the footer renders
- **THEN** it shows the brand blurb and three link columns (Care, Pharmacy, Company) over the same legal line, and every link goes to a real page or is omitted (About, Careers, Contact, Delivery are not designed)

### Requirement: Protected routes prompt in place

The system SHALL ask an anonymous visitor to sign in, with a reason, when they open a route that needs an account, and SHALL return them to that route afterwards.

#### Scenario: Cart while signed out
- **GIVEN** an anonymous visitor
- **WHEN** they open `/cart`
- **THEN** the sign-in card shows "Sign in to view your cart." and after sign-in they land on `/cart`

The reasons are: prescriptions "Sign in to look up your prescriptions."; checkout "Sign in to check out."; order "Sign in to view your order."; labs "Sign in to see your lab tests."; account "Sign in to open your account."

## Components

| Component | Data source |
| --- | --- |
| Logo, primary links, footer | static |
| Cart count | per-session |
| Account slot (initials / Sign in) | per-session |
| Mobile menu | static (not designed) |

## commercetools

Entities: `Cart` (count), `Customer` (initials). Cart count is the session's active cart; anonymous carts may merge at sign-in (see `authentication-and-identity`, `cart-management`), so the count can change at login.

## commercetools skills

Load `commercetools-storefront` before implementing. Supporting: `commercetools-platform`.

## Open questions

- Is the cart count the number of line items (prototype) or total quantity?
- Where does the logo link inside the app: home (prototype goes to the marketing file).
